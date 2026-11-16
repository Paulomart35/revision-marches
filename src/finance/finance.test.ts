import { describe, expect, it } from 'vitest';
import * as fx from './fx';
import * as inf from './inflation';

describe('change', () => {
  it('convertit 1 M$ en euros', () => {
    expect(fx.usdVersEur(1_000_000, 1.0)).toBeCloseTo(1_000_000, 2);
    expect(fx.usdVersEur(1_000_000, 1.25)).toBeCloseTo(800_000, 2);
    expect(fx.usdVersEur(1_000_000, 1.11)).toBeCloseTo(900_900.9, 1);
  });
  it('aller-retour euros ↔ dollars', () => {
    expect(fx.usdVersEur(fx.eurVersUsd(500_000, 1.0837), 1.0837)).toBeCloseTo(500_000, 6);
  });
  it('un exportateur perd quand l\'EUR/USD monte', () => {
    expect(fx.ecartEur(1_000_000, 1.10, 1.20)).toBeCloseTo(-75_757.58, 1);
    expect(fx.ecartEur(1_000_000, 1.10, 1.00)).toBeGreaterThan(0);
  });
  it('valeur du pip : 10 $ par pip pour 100 000 €', () => {
    expect(fx.valeurPips(100_000, 1)).toBeCloseTo(10, 9);
    expect(fx.valeurPips(1_000_000, 50)).toBeCloseTo(5_000, 6);
  });
  it('coût de la fourchette', () => {
    expect(fx.coutFourchette(1_000_000, 1.1000, 1.1002)).toBeCloseTo(200, 6);
  });
  it('variation en %', () => {
    expect(fx.variationPct(1.10, 1.21)).toBeCloseTo(10, 9);
  });
});

describe('inflation', () => {
  it('inflation annuelle à partir de l\'indice', () => {
    expect(inf.inflationAnnuelle(120, 124.8)).toBeCloseTo(4, 9);
  });
  it('moyenne pondérée du panier', () => {
    const postes = [
      { poids: 46, hausse: 3 }, { poids: 26, hausse: 1 }, { poids: 19, hausse: 2 }, { poids: 9, hausse: 20 },
    ];
    expect(inf.inflationPonderee(postes)).toBeCloseTo(3.82, 9);
    expect(inf.contribution(9, 20)).toBeCloseTo(1.8, 9);
  });
  it('pouvoir d\'achat et niveau des prix', () => {
    expect(inf.pouvoirAchat(100, 4, 1)).toBeCloseTo(96.15, 2);
    expect(inf.niveauPrix(2, 10)).toBeCloseTo(121.90, 2);
    expect(inf.niveauPrix(50, 12) / 100).toBeCloseTo(129.75, 2);
  });
  it('taux réel', () => {
    expect(inf.tauxReelApproche(3, 5)).toBe(-2);
    expect(inf.tauxReelExact(3, 5)).toBeCloseTo(-1.905, 3);
  });
});
