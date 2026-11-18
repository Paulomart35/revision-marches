// Calculs du module 6 : ratios prudentiels et mesure du risque de marché.

/** Ratio de fonds propres (CET1, Tier 1 ou total), en % des actifs pondérés par les risques. */
export function ratioFondsPropres(fondsPropres: number, actifsPonderes: number): number {
  return (fondsPropres / actifsPonderes) * 100;
}

/** Ratio de levier, en % : fonds propres Tier 1 ÷ exposition totale non pondérée. */
export function ratioLevier(tier1: number, exposition: number): number {
  return (tier1 / exposition) * 100;
}

/** LCR, en % : actifs liquides de haute qualité ÷ sorties nettes de trésorerie sur 30 jours de stress. */
export function lcr(actifsLiquides: number, sortiesNettes30j: number): number {
  return (actifsLiquides / sortiesNettes30j) * 100;
}

/** Actifs pondérés : exposition × pondération (en %). */
export function actifPondere(exposition: number, ponderationPct: number): number {
  return (exposition * ponderationPct) / 100;
}

/** VaR paramétrique (loi normale) : valeur × volatilité annuelle × √(jours / 252) × quantile. */
export function varParametrique(valeur: number, volAnnuellePct: number, jours: number, quantile = 2.326): number {
  return valeur * (volAnnuellePct / 100) * Math.sqrt(jours / 252) * quantile;
}

/** Passage d'une VaR à 1 jour à une VaR à n jours (règle de la racine du temps). */
export function varEchelle(var1j: number, jours: number): number {
  return var1j * Math.sqrt(jours);
}

/** Perte attendue sur un crédit : probabilité de défaut × perte en cas de défaut × exposition. */
export function perteAttendue(pdPct: number, lgdPct: number, exposition: number): number {
  return (pdPct / 100) * (lgdPct / 100) * exposition;
}
