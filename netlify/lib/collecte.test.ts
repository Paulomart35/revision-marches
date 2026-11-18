import { describe, expect, it } from 'vitest';
import { collecter, DEFINITIONS, glissementAnnuel, lireCsvBce, lireCsvFred, lireEurostat, lireJsonFred, type Marche } from './collecte';

const CSV_BCE = `KEY,FREQ,TIME_PERIOD,OBS_VALUE,TITLE
EXR.D.USD.EUR.SP00.A,D,2026-11-16,1.1014,"US dollar/Euro, 2.15 pm (C.E.T.)"
EXR.D.USD.EUR.SP00.A,D,2026-11-17,1.0989,"US dollar/Euro, 2.15 pm (C.E.T.)"`;

const EUROSTAT = JSON.stringify({
  value: { '0': 3.2, '1': 3.8, '2': 4 },
  status: { '2': 'e' },
  dimension: { time: { category: { index: { '2026-08': 0, '2026-09': 1, '2026-10': 2 } } } },
  size: [1, 1, 1, 1, 3],
});

describe('lecture des formats', () => {
  it('CSV de la BCE, avec des virgules entre guillemets', () => {
    expect(lireCsvBce(CSV_BCE)).toEqual([{ date: '2026-11-16', valeur: 1.1014 }, { date: '2026-11-17', valeur: 1.0989 }]);
  });
  it('CSV de FRED, en ignorant les valeurs manquantes', () => {
    expect(lireCsvFred('observation_date,DGS10\n2026-11-12,5.10\n2026-11-13,\n2026-11-16,5.12')).toEqual([{ date: '2026-11-12', valeur: 5.1 }, { date: '2026-11-16', valeur: 5.12 }]);
  });
  it('JSON de l’API FRED', () => {
    expect(lireJsonFred(JSON.stringify({ observations: [{ date: '2026-11-13', value: '.' }, { date: '2026-11-16', value: '5.12' }] }))).toEqual([{ date: '2026-11-16', valeur: 5.12 }]);
  });
  it('JSON-stat d’Eurostat, avec le statut d’estimation', () => {
    const o = lireEurostat(EUROSTAT);
    expect(o.map((x) => x.valeur)).toEqual([3.2, 3.8, 4]);
    expect(o[2]).toMatchObject({ date: '2026-10', statut: 'e' });
  });
});

describe('glissement annuel', () => {
  it('calcule le dernier mois disponible et signale un mois de référence manquant', () => {
    const obs = [
      { date: '2025-08-01', valeur: 323.976 }, { date: '2025-09-01', valeur: 324.8 },
      { date: '2026-08-01', valeur: 334.98 }, { date: '2026-09-01', valeur: 336.94 }, { date: '2026-10-01', valeur: 337.511 },
    ];
    const g = glissementAnnuel(obs);
    expect(g.courant.date).toBe('2026-09');
    expect(g.courant.valeur).toBeCloseTo(3.74, 2);
    expect(g.precedent?.valeur).toBeCloseTo(3.40, 2);
    expect(g.note).toContain('octobre 2026');
  });
});

describe('collecte', () => {
  // Fausses réponses : chaque source renvoie un format valide.
  const fausse = async (url: string) => {
    if (url.includes('eurostat')) return EUROSTAT;
    if (url.includes('fred')) {
      if (url.includes('CPI')) return 'd,v\n2025-09-01,100\n2025-10-01,101\n2026-09-01,103\n2026-10-01,104';
      return 'd,v\n2026-11-13,4.00\n2026-11-16,4.00';
    }
    if (url.includes('FR.L.L40')) return 'TIME_PERIOD,OBS_VALUE\n2026-09,4.44\n2026-10,4.89';
    if (url.includes('DE.L.L40')) return 'TIME_PERIOD,OBS_VALUE\n2026-09,3.473\n2026-10,3.416';
    if (url.includes('JPY')) return 'TIME_PERIOD,OBS_VALUE\n2026-11-16,175.78\n2026-11-17,175.05';
    return CSV_BCE;
  };

  it('remplit toutes les séries et calcule les séries dérivées', async () => {
    const m = await collecter(null, fausse, undefined, new Date('2026-11-18T17:00:00Z'));
    expect(m.erreurs).toBe(0);
    expect(Object.keys(m.series).sort()).toEqual(DEFINITIONS.map((d) => d.cle).sort());
    expect(m.series['oat-bund'].valeur).toBeCloseTo(147.4, 1);
    expect(m.series['usdjpy'].valeur).toBeCloseTo(175.05 / 1.0989, 6);
    expect(m.series['inflation-ze'].note).toContain('Estimation rapide');
    expect(m.series['inflation-us'].valeur).toBeCloseTo(2.9703, 3); // 104 ÷ 101 − 1
    expect(m.series['fed-funds'].texte).toBe('4,00 % – 4,00 %');
  });

  it("garde la dernière valeur connue d'une source qui ne répond pas", async () => {
    const avant = await collecter(null, fausse, undefined, new Date('2026-11-17T17:00:00Z'));
    const enPanne = async (url: string) => { if (url.includes('eurostat')) throw new Error('HTTP 503'); return fausse(url); };
    const apres: Marche = await collecter(avant, enPanne, undefined, new Date('2026-11-18T17:00:00Z'));
    expect(apres.erreurs).toBe(3);
    expect(apres.series['inflation-ze']).toMatchObject({ statut: 'ancien', erreur: 'HTTP 503', valeur: 4, releve_le: '2026-11-17T17:00:00.000Z' });
    expect(apres.series['eurusd']).toMatchObject({ statut: 'ok', releve_le: '2026-11-18T17:00:00.000Z' });
  });
});
