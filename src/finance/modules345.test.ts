// Tests des calculs des modules 3 (taux), 4 (change) et 5 (structurés).
import { describe, expect, it } from 'vitest';
import * as fx from './fx';
import * as st from './structures';
import * as tx from './taux';

describe('intérêts et actualisation', () => {
  it('intérêts simples Exact/360', () => {
    expect(tx.interetsSimples(10_000_000, 4.2, 90)).toBeCloseTo(105_000, 6);
    expect(tx.interetsSimples(1_000_000, 3, 365, 365)).toBeCloseTo(30_000, 6);
  });
  it('intérêts composés et taux équivalent', () => {
    expect(tx.valeurAcquise(1000, 5, 10)).toBeCloseTo(1628.89, 2);
    expect(tx.tauxActuariel(12, 12)).toBeCloseTo(12.6825, 4);
  });
  it('facteur d\'actualisation et zéro-coupon', () => {
    expect(tx.facteurActualisation(3, 5)).toBeCloseTo(0.862609, 6);
    expect(tx.prixZeroCoupon(3, 5)).toBeCloseTo(86.26, 2);
  });
});

describe('obligations', () => {
  it('le rendement retrouve le taux qui a servi au prix', () => {
    expect(tx.rendementObligation(tx.prixObligation(4, 5, 7), 4, 7)).toBeCloseTo(5, 8);
    expect(tx.rendementObligation(100, 3, 10)).toBeCloseTo(3, 8);
  });
  it('duration d\'une obligation au pair : formule fermée (1 + y)/y × (1 − (1 + y)^−n)', () => {
    expect(tx.durationMacaulay(5, 5, 5)).toBeCloseTo((1.05 / 0.05) * (1 - Math.pow(1.05, -5)), 10);
    expect(tx.durationMacaulay(5, 5, 5)).toBeCloseTo(4.546, 3);
    expect(tx.sensibilite(5, 5, 5)).toBeCloseTo(4.3295, 4);
  });
  it('duration d\'un zéro-coupon = sa maturité', () => {
    expect(tx.durationMacaulay(0, 4, 10)).toBeCloseTo(10, 10);
  });
  it('convexité : égale à la dérivée seconde numérique divisée par le prix', () => {
    const P = (y: number) => tx.prixObligation(4, y * 100, 10);
    const h = 1e-4, y = 0.05;
    const num = (P(y + h) - 2 * P(y) + P(y - h)) / (h * h) / P(y);
    expect(tx.convexite(4, 5, 10)).toBeCloseTo(num, 2);
  });
  it('DV01 ≈ prix × sensibilité / 10 000', () => {
    expect(tx.dv01(5, 5, 5, 1_000_000)).toBeCloseTo(1_000_000 * 4.3295 / 10_000, 0);
  });
  it('la convexité améliore l\'approximation', () => {
    const exacte = tx.variationPrixExacte(3, 3, 20, 100);
    const sans = tx.variationPrixApprochee(3, 3, 20, 100, 0);
    const avec = tx.variationPrixApprochee(3, 3, 20, 100);
    expect(Math.abs(avec - exacte)).toBeLessThan(Math.abs(sans - exacte) / 5);
  });
});

describe('courbe, crédit, swaps', () => {
  it('taux forward', () => {
    expect(tx.tauxForward(2, 1, 3, 2)).toBeCloseTo((1.03 ** 2 / 1.02 - 1) * 100, 10);
  });
  it('probabilité de défaut implicite', () => {
    expect(tx.probaDefaut(240, 40)).toBeCloseTo(4, 10);
  });
  it('taux de swap : courbe plate à 3 % donne 3 %', () => {
    expect(tx.tauxSwap(3, 3, 3, 3, 3)).toBeCloseTo(3, 10);
    expect(tx.tauxSwap(2, 2.5, 3)).toBeGreaterThan(2.5);
    expect(tx.tauxSwap(2, 2.5, 3)).toBeLessThan(3);
  });
  it('valeur d\'un swap payeur après une hausse des taux', () => {
    expect(tx.annuite(3.5, 4)).toBeCloseTo(3.6731, 4);
    expect(tx.valeurSwapPayeur(10_000_000, 3, 3.5, 4)).toBeCloseTo(183_654, 0);
    expect(tx.annuite(3, 5)).toBeCloseTo(4.5797, 4);
  });
  it('flux d\'un trimestre de swap', () => {
    expect(tx.fluxSwap(10_000_000, 3, 3.5, 90)).toBeCloseTo(12_500, 6);
    expect(tx.fluxSwap(10_000_000, 3, 1.5, 90)).toBeCloseTo(-37_500, 6);
  });
  it('cap et tunnel', () => {
    expect([1.5, 2.75, 4.5].map((e) => tx.coutAvecCap(e, 3.25, 1.2, 0.3))).toEqual([3, 4.25, 4.75].map((v) => expect.closeTo(v, 10)));
    expect([1.5, 2.75, 4.5].map((e) => tx.coutAvecTunnel(e, 2.25, 3.5, 1.2))).toEqual([3.45, 3.95, 4.7].map((v) => expect.closeTo(v, 10)));
  });
  it('future de taux', () => {
    expect(tx.prixFutureTaux(2.25)).toBe(97.75);
  });
});

describe('change à terme et couvertures', () => {
  it('cours à terme EUR/USD par arbitrage', () => {
    const F = fx.coursTerme(1.12, 3.9, 2.7, 365);
    expect(F).toBeCloseTo(1.13326, 5);
    expect(fx.pointsTerme(1.12, F)).toBeCloseTo(132.6, 1);
    expect(fx.coursTerme(1.10, 2, 4, 180)).toBeLessThan(1.10);
  });
  it('importateur couvert par une option', () => {
    expect(fx.coutImportateurOption(1_000_000, 1.12, 13_000, 1.06)).toBeCloseTo(905_857, 0);
    expect(fx.coutImportateurOption(1_000_000, 1.12, 13_000, 1.18)).toBeCloseTo(860_458, 0);
  });
  it('exportateur : tunnel et terme participatif', () => {
    expect(fx.exportateurTunnel(1_000_000, 1.10, 1.16, 1.20)).toBeCloseTo(1_000_000 / 1.16, 6);
    expect(fx.exportateurTunnel(1_000_000, 1.10, 1.16, 1.05)).toBeCloseTo(1_000_000 / 1.10, 6);
    expect(fx.exportateurParticipatif(1_000_000, 1.145, 50, 1.08)).toBeCloseTo(899_644, 0);
    expect(fx.exportateurParticipatif(1_000_000, 1.145, 50, 1.20)).toBeCloseTo(873_362, 0);
  });
  it('carry trade', () => {
    expect(fx.rendementCarry(0.5, 5, 0)).toBeCloseTo(4.5, 10);
    expect(fx.rendementCarry(0.5, 5, -10)).toBeCloseTo(-6, 10);
  });
});

describe('produits structurés', () => {
  it('participation d\'un capital garanti', () => {
    expect(st.participation(3, 5, 16, 2)).toBeCloseTo(73.37, 2);
    expect(st.participation(1, 5, 16, 2)).toBeCloseTo(17.8, 1);
    expect(st.rembourseCapitalGaranti(70, 130)).toBeCloseTo(121, 10);
    expect(st.rembourseCapitalGaranti(70, 80)).toBe(100);
  });
  it('Phoenix à mémoire : 7, 0, 14, 107', () => {
    const r = st.phoenix([90, 65, 80, 102], 7, 70, 100, 60, true);
    expect(r.flux).toEqual([7, 0, 14, 107]);
    expect(r.total).toBe(128);
    expect(st.phoenix([90, 65, 80, 102, 95], 7, 70, 100, 60, true).rappel).toBe(true);
    expect(st.phoenix([90, 65, 80, 102], 7, 70, 100, 60, false).total).toBe(121);
  });
  it('Athena : rappel, protection, perte', () => {
    expect(st.phoenix([95, 104], 7, 100, 100, 60, true).total).toBe(114);
    const b = st.phoenix([90, 85, 80, 78, 75], 7, 100, 100, 60, true);
    expect(b.total).toBe(100);
    expect(b.perte).toBe(false);
    const c = st.phoenix([90, 80, 70, 60, 52], 7, 100, 100, 60, true);
    expect(c.total).toBe(52);
    expect(c.perte).toBe(true);
    expect(st.phoenix([90, 85, 80, 78, 101], 7, 100, 100, 60, true).total).toBe(135);
  });
  it('reverse convertible, range accrual, rendement annuel', () => {
    expect(st.reverseConvertible(8, 70, 85)).toBe(108);
    expect(st.reverseConvertible(8, 70, 60)).toBe(68);
    expect(st.rangeAccrual(4, 200, 250)).toBeCloseTo(3.2, 10);
    expect(st.rendementAnnuel(114, 100, 2)).toBeCloseTo(6.77, 2);
  });
});
