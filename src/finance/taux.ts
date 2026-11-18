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

/* ---------- Module 3 : intérêts, actualisation, obligations, courbe, swaps ---------- */
// Convention : taux en %, durées en années (sauf mention), nominal de 100 par défaut.

/** Intérêts simples sur un nombre de jours, base 360 (monétaire euro) ou 365. */
export function interetsSimples(capital: number, tauxPct: number, jours: number, base = 360): number {
  return capital * (tauxPct / 100) * (jours / base);
}

/** Valeur acquise avec intérêts composés, n capitalisations par an. */
export function valeurAcquise(capital: number, tauxPct: number, annees: number, n = 1): number {
  return capital * Math.pow(1 + tauxPct / 100 / n, n * annees);
}

/** Taux annuel équivalent d'un taux capitalisé n fois par an, en %. */
export function tauxActuariel(tauxPct: number, n: number): number {
  return (Math.pow(1 + tauxPct / 100 / n, n) - 1) * 100;
}

/** Facteur d'actualisation : ce que vaut aujourd'hui 1 reçu dans t années. */
export function facteurActualisation(tauxPct: number, t: number): number {
  return Math.pow(1 + tauxPct / 100, -t);
}

/** Valeur actuelle d'un montant reçu dans t années. */
export function valeurActuelle(montant: number, tauxPct: number, t: number): number {
  return montant * facteurActualisation(tauxPct, t);
}

/** Prix d'un zéro-coupon. */
export function prixZeroCoupon(tauxPct: number, annees: number, nominal = 100): number {
  return valeurActuelle(nominal, tauxPct, annees);
}

/** Rendement actuariel d'une obligation à coupon annuel, à partir de son prix (recherche par dichotomie), en %. */
export function rendementObligation(prix: number, couponPct: number, annees: number, nominal = 100): number {
  let bas = -50, haut = 100;
  for (let i = 0; i < 200; i++) {
    const m = (bas + haut) / 2;
    if (prixObligation(couponPct, m, annees, nominal) > prix) bas = m; else haut = m;
  }
  return (bas + haut) / 2;
}

/** Duration de Macaulay (en années) d'une obligation à coupon annuel. */
export function durationMacaulay(couponPct: number, tauxPct: number, annees: number): number {
  const y = tauxPct / 100;
  let somme = 0;
  for (let t = 1; t <= annees; t++) somme += (t * (couponPct + (t === annees ? 100 : 0))) / Math.pow(1 + y, t);
  return somme / prixObligation(couponPct, tauxPct, annees);
}

/** Sensibilité (duration modifiée) : baisse du prix en % pour +1 point de taux. */
export function sensibilite(couponPct: number, tauxPct: number, annees: number): number {
  return durationMacaulay(couponPct, tauxPct, annees) / (1 + tauxPct / 100);
}

/** DV01 : gain de prix pour 1 point de base de baisse du taux, pour un nominal donné. */
export function dv01(couponPct: number, tauxPct: number, annees: number, nominal = 100): number {
  const h = 0.01;
  return ((prixObligation(couponPct, tauxPct - h, annees) - prixObligation(couponPct, tauxPct + h, annees)) / 2) * (nominal / 100);
}

/** Convexité d'une obligation à coupon annuel (en années²). */
export function convexite(couponPct: number, tauxPct: number, annees: number): number {
  const y = tauxPct / 100;
  let somme = 0;
  for (let t = 1; t <= annees; t++) somme += (t * (t + 1) * (couponPct + (t === annees ? 100 : 0))) / Math.pow(1 + y, t + 2);
  return somme / prixObligation(couponPct, tauxPct, annees);
}

/** Variation de prix approchée, en %, pour une variation de taux en points de base (sensibilité, plus la convexité si avecConvexite = 1). */
export function variationPrixApprochee(couponPct: number, tauxPct: number, annees: number, dyPb: number, avecConvexite = 1): number {
  const dy = dyPb / 10_000;
  return (-sensibilite(couponPct, tauxPct, annees) * dy + avecConvexite * 0.5 * convexite(couponPct, tauxPct, annees) * dy * dy) * 100;
}

/** Variation de prix exacte, en %, pour une variation de taux en points de base. */
export function variationPrixExacte(couponPct: number, tauxPct: number, annees: number, dyPb: number): number {
  return (prixObligation(couponPct, tauxPct + dyPb / 100, annees) / prixObligation(couponPct, tauxPct, annees) - 1) * 100;
}

/** Taux forward entre t1 et t2, déduit des taux zéro-coupon r1 (à t1) et r2 (à t2), en %. */
export function tauxForward(r1Pct: number, t1: number, r2Pct: number, t2: number): number {
  return (Math.pow(Math.pow(1 + r2Pct / 100, t2) / Math.pow(1 + r1Pct / 100, t1), 1 / (t2 - t1)) - 1) * 100;
}

/** Probabilité de défaut annuelle implicite (approximation : spread ÷ (1 − taux de recouvrement)), en %. */
export function probaDefaut(spreadPb: number, recouvrementPct: number): number {
  return spreadPb / 100 / (1 - recouvrementPct / 100);
}

/** Annuité : somme des facteurs d'actualisation des années 1 à n, à un taux unique. */
export function annuite(tauxPct: number, annees: number): number {
  let a = 0;
  for (let t = 1; t <= annees; t++) a += facteurActualisation(tauxPct, t);
  return a;
}

/** Taux d'un swap à paiements annuels, à partir des taux zéro-coupon des années 1, 2, …, n (en %). */
export function tauxSwap(...zcPct: number[]): number {
  const df = zcPct.map((z, i) => facteurActualisation(z, i + 1));
  return ((1 - df[df.length - 1]) / df.reduce((a, b) => a + b, 0)) * 100;
}

/** Valeur de marché d'un swap pour celui qui paie le fixe (courbe plate au taux de swap du marché). */
export function valeurSwapPayeur(nominal: number, tauxFixePct: number, tauxMarchePct: number, annees: number): number {
  return ((nominal * (tauxMarchePct - tauxFixePct)) / 100) * annuite(tauxMarchePct, annees);
}

/** Flux net d'une période de swap, vu de celui qui paie le fixe et reçoit l'Euribor (base Exact/360). */
export function fluxSwap(nominal: number, tauxFixePct: number, euriborPct: number, jours: number): number {
  return interetsSimples(nominal, euriborPct - tauxFixePct, jours);
}

/** Taux payé par un emprunteur à Euribor + marge, couvert par un cap (prime annuelle en %). */
export function coutAvecCap(euriborPct: number, strikePct: number, margePct: number, primePct: number): number {
  return Math.min(euriborPct, strikePct) + margePct + primePct;
}

/** Taux payé par un emprunteur à Euribor + marge, couvert par un tunnel (achat de cap, vente de floor). */
export function coutAvecTunnel(euriborPct: number, plancherPct: number, plafondPct: number, margePct: number): number {
  return Math.min(Math.max(euriborPct, plancherPct), plafondPct) + margePct;
}

/** Prix d'un future de taux court : 100 − taux. */
export function prixFutureTaux(tauxPct: number): number {
  return 100 - tauxPct;
}
