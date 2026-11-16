// Calculs d'inflation.

/** Inflation sur un an, en %, à partir de deux niveaux d'indice de prix. */
export function inflationAnnuelle(indiceAvant: number, indiceApres: number): number {
  return (indiceApres / indiceAvant - 1) * 100;
}

/** Inflation totale = moyenne des hausses de prix de chaque poste, pondérée par son poids (poids en %, somme = 100). */
export function inflationPonderee(postes: { poids: number; hausse: number }[]): number {
  const total = postes.reduce((s, p) => s + p.poids, 0);
  return postes.reduce((s, p) => s + p.poids * p.hausse, 0) / total;
}

/** Contribution d'un poste à l'inflation totale, en points de pourcentage. */
export function contribution(poids: number, hausse: number): number {
  return (poids * hausse) / 100;
}

/** Pouvoir d'achat restant d'une somme après n années d'inflation à taux constant (en %). */
export function pouvoirAchat(somme: number, inflationPct: number, annees: number): number {
  return somme / Math.pow(1 + inflationPct / 100, annees);
}

/** Niveau des prix après n années d'inflation constante (base 100). */
export function niveauPrix(inflationPct: number, annees: number, base = 100): number {
  return base * Math.pow(1 + inflationPct / 100, annees);
}

/** Taux réel approché : taux nominal moins inflation (en points). */
export function tauxReelApproche(nominalPct: number, inflationPct: number): number {
  return nominalPct - inflationPct;
}

/** Taux réel exact (relation de Fisher), en %. */
export function tauxReelExact(nominalPct: number, inflationPct: number): number {
  return ((1 + nominalPct / 100) / (1 + inflationPct / 100) - 1) * 100;
}
