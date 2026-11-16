// Calculs de taux utilisés par le module 1 (les obligations et les swaps sont approfondis dans le module 3).

/** Prix d'une obligation à coupon annuel, pour 100 de nominal. Taux en %. */
export function prixObligation(couponPct: number, tauxPct: number, annees: number, nominal = 100): number {
  const y = tauxPct / 100;
  let prix = 0;
  for (let t = 1; t <= annees; t++) prix += (couponPct / 100) * nominal / Math.pow(1 + y, t);
  return prix + nominal / Math.pow(1 + y, annees);
}

/** Mensualité constante d'un crédit amortissable. Taux annuel en %, durée en années. */
export function mensualite(capital: number, tauxPct: number, annees: number): number {
  const r = tauxPct / 100 / 12;
  const n = annees * 12;
  if (r === 0) return capital / n;
  return (capital * r) / (1 - Math.pow(1 + r, -n));
}

/** Coût total des intérêts d'un crédit amortissable à mensualités constantes. */
export function coutCredit(capital: number, tauxPct: number, annees: number): number {
  return mensualite(capital, tauxPct, annees) * annees * 12 - capital;
}

/** Règle de Taylor : taux directeur conseillé, en %. Coefficients 0,5 par défaut (Taylor, 1993). */
export function regleTaylor(tauxReelNeutre: number, inflation: number, cible: number, ecartProduction: number, a = 0.5, b = 0.5): number {
  return tauxReelNeutre + inflation + a * (inflation - cible) + b * ecartProduction;
}

/** Écart entre deux taux, en points de base. */
export function ecartPb(tauxA: number, tauxB: number): number {
  return (tauxA - tauxB) * 100;
}

/** Croissance trimestrielle convertie en rythme annualisé (convention américaine), en %. */
export function annualiser(trimestrielPct: number): number {
  return (Math.pow(1 + trimestrielPct / 100, 4) - 1) * 100;
}

/** Intérêts annuels sur un capital, pour un taux en %. */
export function interets(capital: number, tauxPct: number): number {
  return (capital * tauxPct) / 100;
}

/** Dette en % du PIB l'année suivante : effet boule de neige (taux contre croissance) + déficit primaire. */
export function detteSuivante(dettePct: number, tauxPct: number, croissancePct: number, deficitPrimairePct: number): number {
  return (dettePct * (1 + tauxPct / 100)) / (1 + croissancePct / 100) + deficitPrimairePct;
}
