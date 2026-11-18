// Calculs de change. Convention : EUR/USD = nombre de dollars pour 1 euro.

/** Convertit un montant en dollars en euros au cours EUR/USD donné. */
export function usdVersEur(montantUsd: number, eurusd: number): number {
  return montantUsd / eurusd;
}

/** Convertit un montant en euros en dollars au cours EUR/USD donné. */
export function eurVersUsd(montantEur: number, eurusd: number): number {
  return montantEur * eurusd;
}

/** Écart en euros, pour un flux en dollars, entre deux cours (positif = plus d'euros au second cours). */
export function ecartEur(montantUsd: number, coursInitial: number, coursFinal: number): number {
  return usdVersEur(montantUsd, coursFinal) - usdVersEur(montantUsd, coursInitial);
}

/** Valeur en devise de cotation d'un mouvement de n pips sur un nominal en devise de base. */
export function valeurPips(nominalBase: number, nPips: number, taillePip = 0.0001): number {
  return nominalBase * nPips * taillePip;
}

/** Coût de la fourchette achat-vente, en devise de cotation, pour un aller-retour sur un nominal en devise de base. */
export function coutFourchette(nominalBase: number, bid: number, ask: number): number {
  return nominalBase * (ask - bid);
}

/** Variation en % d'un cours. */
export function variationPct(avant: number, apres: number): number {
  return (apres / avant - 1) * 100;
}

/* ---------- Module 4 : change à terme et couvertures ---------- */

/**
 * Cours à terme par arbitrage (parité des taux couverte), intérêts simples.
 * Cours coté en devise de cotation pour 1 devise de base (EUR/USD : base EUR, cotation USD).
 */
export function coursTerme(spot: number, tauxCotationPct: number, tauxBasePct: number, jours: number, baseCotation = 360, baseBase = 360): number {
  return (spot * (1 + (tauxCotationPct / 100) * (jours / baseCotation))) / (1 + (tauxBasePct / 100) * (jours / baseBase));
}

/** Points de terme, en pips : (terme − comptant) × 10 000. Positifs : la devise de base est en report ; négatifs : en déport. */
export function pointsTerme(spot: number, terme: number): number {
  return (terme - spot) * 10_000;
}

/** Coût en euros d'un importateur qui paie un montant en dollars, couvert par un put EUR / call USD. */
export function coutImportateurOption(montantUsd: number, strike: number, primeEur: number, spotFinal: number): number {
  return montantUsd / Math.max(spotFinal, strike) + primeEur;
}

/** Euros reçus par un exportateur couvert par un tunnel (cours effectif borné entre plancher et plafond). */
export function exportateurTunnel(montantUsd: number, plancher: number, plafond: number, spotFinal: number): number {
  return montantUsd / Math.min(Math.max(spotFinal, plancher), plafond);
}

/** Euros reçus par un exportateur couvert par un terme participatif (participation en % si le cours finit sous le cours garanti). */
export function exportateurParticipatif(montantUsd: number, garanti: number, participationPct: number, spotFinal: number): number {
  if (spotFinal >= garanti) return montantUsd / garanti;
  const p = participationPct / 100;
  return ((1 - p) * montantUsd) / garanti + (p * montantUsd) / spotFinal;
}

/** Rendement d'un carry trade sur un an, en % du montant emprunté : placer à un taux haut, emprunter à un taux bas, subir la variation de la devise placée. */
export function rendementCarry(tauxEmpruntPct: number, tauxPlacementPct: number, variationDevisePct: number): number {
  return ((1 + tauxPlacementPct / 100) * (1 + variationDevisePct / 100) - (1 + tauxEmpruntPct / 100)) * 100;
}
