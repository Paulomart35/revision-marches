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
