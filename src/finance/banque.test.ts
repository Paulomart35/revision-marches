import { describe, expect, it } from 'vitest';
import * as bq from './banque';

describe('ratios prudentiels et risque de marché', () => {
  it('ratios de fonds propres, levier, LCR', () => {
    expect(bq.ratioFondsPropres(13, 100)).toBeCloseTo(13, 10);
    expect(bq.ratioLevier(5, 125)).toBeCloseTo(4, 10);
    expect(bq.lcr(130, 100)).toBeCloseTo(130, 10);
    expect(bq.actifPondere(1_000_000, 100)).toBe(1_000_000);
    expect(bq.actifPondere(1_000_000, 35)).toBeCloseTo(350_000, 6);
  });
  it('VaR paramétrique et racine du temps', () => {
    // 10 M€, volatilité 20 %, 1 jour, 99 % : 10 M × 0,2 / √252 × 2,326
    expect(bq.varParametrique(10_000_000, 20, 1)).toBeCloseTo(10_000_000 * 0.2 / Math.sqrt(252) * 2.326, 6);
    expect(bq.varParametrique(10_000_000, 20, 1)).toBeCloseTo(293_048, 0);
    expect(bq.varEchelle(100_000, 10)).toBeCloseTo(316_228, 0);
    expect(bq.varParametrique(10_000_000, 20, 10)).toBeCloseTo(bq.varEchelle(bq.varParametrique(10_000_000, 20, 1), 10), 6);
  });
  it('perte attendue', () => {
    expect(bq.perteAttendue(2, 60, 10_000_000)).toBeCloseTo(120_000, 6);
  });
});
