import { describe, expect, it } from 'vitest';
import * as o from './options';

// Valeurs de référence : J. Hull, « Options, Futures, and Other Derivatives » (exemples classiques du manuel).
describe('loi normale', () => {
  it('valeurs tabulées', () => {
    expect(o.N(0)).toBeCloseTo(0.5, 12);
    expect(o.N(1)).toBeCloseTo(0.8413447461, 9);
    expect(o.N(-1)).toBeCloseTo(0.1586552539, 9);
    expect(o.N(1.96)).toBeCloseTo(0.9750021049, 9);
    expect(o.N(-3)).toBeCloseTo(0.0013498980, 9);
    expect(o.N(8)).toBeCloseTo(1, 12);
  });
});

describe('Black-Scholes', () => {
  it('Hull : S = 42, K = 40, r = 10 %, σ = 20 %, T = 6 mois → call 4,76 et put 0,81', () => {
    const p = { S: 42, K: 40, T: 0.5, r: 0.1, sigma: 0.2 };
    const c = o.bs('call', p), put = o.bs('put', p);
    expect(c.d1).toBeCloseTo(0.7693, 4);
    expect(c.d2).toBeCloseTo(0.6278, 4);
    expect(c.prix).toBeCloseTo(4.76, 2);
    expect(put.prix).toBeCloseTo(0.81, 2);
  });
  it('Hull : grecques du call S = 49, K = 50, r = 5 %, σ = 20 %, T = 20 semaines', () => {
    const g = o.bs('call', { S: 49, K: 50, T: 0.3846, r: 0.05, sigma: 0.2 });
    expect(g.prix).toBeCloseTo(2.4, 1);
    expect(g.delta).toBeCloseTo(0.522, 3);
    expect(g.gamma).toBeCloseTo(0.066, 3);
    expect(g.vega).toBeCloseTo(12.1, 1);
    expect(g.theta).toBeCloseTo(-4.31, 2);
    expect(g.rho).toBeCloseTo(8.91, 2);
  });
  it('parité call-put, avec et sans dividende', () => {
    for (const q of [0, 0.03]) {
      const p = { S: 100, K: 95, T: 1.5, r: 0.03, sigma: 0.25, q };
      expect(o.bs('call', p).prix - o.bs('put', p).prix).toBeCloseTo(o.pariteCallPut(100, 95, 1.5, 0.03, q), 10);
    }
  });
  it('relations entre grecques du call et du put', () => {
    const p = { S: 100, K: 110, T: 0.75, r: 0.02, sigma: 0.3 };
    const c = o.bs('call', p), put = o.bs('put', p);
    expect(c.delta - put.delta).toBeCloseTo(1, 10);
    expect(c.gamma).toBeCloseTo(put.gamma, 12);
    expect(c.vega).toBeCloseTo(put.vega, 12);
  });
  it("à la monnaie, 0,4 × S × σ × √T est une bonne approximation", () => {
    const c = o.bs('call', { S: 100, K: 100, T: 1, r: 0, sigma: 0.2 });
    expect(c.prix).toBeCloseTo(7.966, 3);
    expect(o.approxATM(100, 0.2, 1)).toBe(8);
  });
  it("les grecques analytiques coïncident avec les dérivées numériques (bump and reprice)", () => {
    const p = { S: 100, K: 105, T: 0.5, r: 0.03, sigma: 0.22, q: 0.01 };
    const g = o.bs('call', p);
    expect(o.deltaBump('call', p, 0.01)).toBeCloseTo(g.delta, 6);
    expect(o.gammaBump('call', p, 0.01)).toBeCloseTo(g.gamma, 5);
    const h = 1e-5;
    expect((o.bs('call', { ...p, sigma: p.sigma + h }).prix - o.bs('call', { ...p, sigma: p.sigma - h }).prix) / (2 * h)).toBeCloseTo(g.vega, 4);
    expect(-(o.bs('call', { ...p, T: p.T + h }).prix - o.bs('call', { ...p, T: p.T - h }).prix) / (2 * h)).toBeCloseTo(g.theta, 4);
    expect((o.bs('call', { ...p, r: p.r + h }).prix - o.bs('call', { ...p, r: p.r - h }).prix) / (2 * h)).toBeCloseTo(g.rho, 4);
  });
  it("à l'échéance, l'option vaut sa valeur intrinsèque", () => {
    expect(o.bs('call', { S: 110, K: 100, T: 0, r: 0.03, sigma: 0.2 }).prix).toBe(10);
    expect(o.bs('put', { S: 110, K: 100, T: 0, r: 0.03, sigma: 0.2 }).prix).toBe(0);
  });
});

describe('Black et Garman-Kohlhagen', () => {
  it('Hull : put sur future pétrole F = 20, K = 20, r = 9 %, T = 4 mois, σ = 25 % → 1,12', () => {
    expect(o.black76('put', 20, 20, 4 / 12, 0.09, 0.25)).toBeCloseTo(1.12, 2);
  });
  it('Garman-Kohlhagen = Black sur le cours à terme', () => {
    const S = 1.1, rd = 0.04, rf = 0.025, T = 0.5;
    const F = S * Math.exp((rd - rf) * T);
    expect(o.garmanKohlhagen('call', S, 1.12, T, rd, rf, 0.08)).toBeCloseTo(o.black76('call', F, 1.12, T, rd, 0.08), 12);
  });
});

describe('volatilité implicite', () => {
  it('retrouve la volatilité utilisée pour calculer le prix', () => {
    for (const [sens, K, s] of [['call', 100, 0.2], ['put', 80, 0.35], ['call', 130, 0.15]] as const) {
      const prix = o.bs(sens, { S: 100, K, T: 1, r: 0.03, sigma: s }).prix;
      expect(o.volImplicite(sens, prix, 100, K, 1, 0.03)).toBeCloseTo(s, 8);
    }
  });
  it("renvoie NaN pour un prix impossible", () => {
    expect(o.volImplicite('call', 0.0001, 100, 50, 1, 0)).toBeNaN();
  });
});

describe('arbre binomial', () => {
  it('Hull : put américain S = 50, K = 50, r = 10 %, σ = 40 %, T = 5 mois, 5 étapes → 4,49', () => {
    expect(o.arbreBinomial('put', 50, 50, 5 / 12, 0.1, 0.4, 5, true).prix).toBeCloseTo(4.49, 2);
  });
  it("converge vers Black-Scholes pour une option européenne", () => {
    const bsPrix = o.bs('call', { S: 100, K: 100, T: 1, r: 0.03, sigma: 0.2 }).prix;
    expect(Math.abs(o.binomial('call', 100, 100, 1, 0.03, 0.2, 2000, false) - bsPrix)).toBeLessThan(0.005);
  });
  it("le call américain sans dividende vaut le call européen ; le put américain vaut plus", () => {
    expect(o.binomial('call', 100, 100, 1, 0.05, 0.2, 500, true)).toBeCloseTo(o.binomial('call', 100, 100, 1, 0.05, 0.2, 500, false), 10);
    expect(o.binomial('put', 100, 100, 1, 0.05, 0.2, 500, true)).toBeGreaterThan(o.binomial('put', 100, 100, 1, 0.05, 0.2, 500, false) + 0.2);
  });
  it('la version avec arbre et la version compacte donnent le même prix', () => {
    expect(o.arbreBinomial('put', 100, 105, 1, 0.04, 0.3, 40, true).prix).toBeCloseTo(o.binomial('put', 100, 105, 1, 0.04, 0.3, 40, true), 10);
  });
});

describe('Monte Carlo', () => {
  it("l'estimation tombe à moins de 3 marges d'erreur de Black-Scholes", () => {
    const bsPrix = o.bs('call', { S: 100, K: 100, T: 1, r: 0.03, sigma: 0.2 }).prix;
    const mc = o.monteCarlo('call', 100, 100, 1, 0.03, 0.2, 200_000, 7);
    expect(Math.abs(mc.prix - bsPrix)).toBeLessThan(3 * mc.erreur);
    expect(mc.erreur).toBeLessThan(0.05);
  });
  it("la marge d'erreur est divisée par 2 quand on multiplie les tirages par 4", () => {
    const a = o.monteCarlo('call', 100, 100, 1, 0.03, 0.2, 20_000, 3);
    const b = o.monteCarlo('call', 100, 100, 1, 0.03, 0.2, 80_000, 3);
    expect(a.erreur / b.erreur).toBeGreaterThan(1.85);
    expect(a.erreur / b.erreur).toBeLessThan(2.15);
    expect(o.erreurMC(15, 10_000)).toBeCloseTo(0.15, 12);
  });
  it('le générateur est reproductible', () => {
    const a = o.generateur(42), b = o.generateur(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('exotiques', () => {
  it('une digitale vaut la limite d’un écart de calls très serré', () => {
    const p = { S: 100, K: 100, T: 1, r: 0.03, sigma: 0.2 };
    const h = 0.001;
    const ecart = (o.bs('call', { ...p, K: 100 - h }).prix - o.bs('call', { ...p, K: 100 + h }).prix) / (2 * h);
    expect(o.digitale('call', p)).toBeCloseTo(ecart, 5);
    expect(o.digitale('call', p) + o.digitale('put', p)).toBeCloseTo(Math.exp(-0.03), 12);
  });
  it('put à barrière : parité in-out et cas limites', () => {
    const p = { S: 100, K: 100, T: 1, r: 0.03, sigma: 0.2 };
    const vanille = o.bs('put', p).prix;
    expect(o.putDownIn(p, 70) + o.putDownOut(p, 70)).toBeCloseTo(vanille, 10);
    expect(o.putDownIn(p, 1)).toBeCloseTo(0, 6); // barrière inatteignable
    expect(o.putDownIn(p, 99.999)).toBeCloseTo(vanille, 2); // barrière déjà presque touchée
    expect(o.putDownIn(p, 70)).toBeLessThan(vanille);
  });
  it('put down-and-in : formule fermée confirmée par une simulation', () => {
    const p = { S: 100, K: 100, T: 1, r: 0.03, sigma: 0.25 };
    const H = 75, pas = 400, n = 40_000, dt = p.T / pas;
    const z = o.gaussien(o.generateur(11));
    let somme = 0, carres = 0;
    for (let i = 0; i < n; i++) {
      let s = p.S, touche = false;
      for (let k = 0; k < pas; k++) {
        s *= Math.exp((p.r - p.sigma ** 2 / 2) * dt + p.sigma * Math.sqrt(dt) * z());
        if (s <= H) touche = true;
      }
      const g = touche ? Math.exp(-p.r * p.T) * Math.max(p.K - s, 0) : 0;
      somme += g; carres += g * g;
    }
    const m = somme / n, err = Math.sqrt((carres / n - m * m) / n);
    // Correction de Broadie-Glasserman : une surveillance discrète équivaut à une barrière continue un peu plus basse.
    const Hcorr = H * Math.exp(-0.5826 * p.sigma * Math.sqrt(dt));
    expect(Math.abs(m - o.putDownIn(p, Hcorr))).toBeLessThan(3.5 * err);
  });
  it("une asiatique vaut moins que la vanille correspondante", () => {
    const p = { S: 100, K: 100, T: 1, r: 0.03, sigma: 0.25 };
    expect(o.asiatiqueGeometrique('call', p)).toBeLessThan(o.bs('call', p).prix);
    expect(o.asiatiqueGeometrique('call', p)).toBeGreaterThan(0.4 * o.bs('call', p).prix);
  });
});

describe('couverture, volatilité réalisée, stratégies', () => {
  it('résultat journalier couvert', () => {
    expect(o.pnlCouvert(0.02, 2, -0.015)).toBeCloseTo(0.025, 12);
    expect(o.pnlCouvert(0.02, 0, -0.015)).toBeCloseTo(-0.015, 12);
  });
  it('volatilité réalisée : des rendements de ±1 % tous les jours donnent environ 16 %', () => {
    const cours = [100];
    for (let i = 0; i < 252; i++) cours.push(cours[i] * Math.exp(i % 2 ? -0.01 : 0.01));
    expect(o.volRealisee(cours)).toBeCloseTo(0.1590, 3);
  });
  it('payoffs de stratégies', () => {
    const straddle: o.Jambe[] = [{ type: 'call', K: 100, quantite: 1 }, { type: 'put', K: 100, quantite: 1 }];
    expect(o.gainEcheance(straddle, 120)).toBe(20);
    expect(o.gainEcheance(straddle, 85)).toBe(15);
    const callSpread: o.Jambe[] = [{ type: 'call', K: 100, quantite: 1 }, { type: 'call', K: 110, quantite: -1 }];
    expect(o.gainEcheance(callSpread, 150)).toBe(10);
    const collar: o.Jambe[] = [{ type: 'sous-jacent', quantite: 1 }, { type: 'put', K: 90, quantite: 1 }, { type: 'call', K: 110, quantite: -1 }];
    expect(o.gainEcheance(collar, 60, 100)).toBe(-10);
    expect(o.gainEcheance(collar, 150, 100)).toBe(10);
  });
});
