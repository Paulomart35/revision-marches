import { describe, expect, it } from 'vitest';
import { decisionGouverneur } from './politique';

describe('Toi, gouverneur de la BCE', () => {
  it('surchauffe par la demande : on monte', () => {
    expect(decisionGouverneur(5, 3, 'demande').classe).toBe('up');
    expect(decisionGouverneur(3, 2, 'demande').classe).toBe('up');
  });
  it('inflation trop basse : on baisse', () => {
    expect(decisionGouverneur(0.3, -6, 'demande').classe).toBe('down');
    expect(decisionGouverneur(1, 1, 'demande').classe).toBe('down');
  });
  it('inflation à la cible et croissance normale : on maintient', () => {
    expect(decisionGouverneur(2, 1.3, 'demande').classe).toBe('hold');
  });
  it('choc d\u2019énergie modéré avec économie à l\u2019arrêt : on regarde au travers', () => {
    expect(decisionGouverneur(3.5, 0, 'energie').classe).toBe('hold');
  });
  it('les situations réelles donnent le sens des décisions de la BCE', () => {
    expect(decisionGouverneur(4.0, 1.3, 'energie').classe).toBe('up'); // 2026
    expect(decisionGouverneur(10.6, 2.5, 'energie').classe).toBe('up'); // 2022
    expect(decisionGouverneur(8, -1, 'energie').classe).toBe('up'); // stagflation
  });
});
