// Calculs des produits structurés (module 5). Montants pour 100 investis, niveaux en % du niveau initial.
import { facteurActualisation } from './taux';

/** Participation à la hausse d'un capital garanti, en % : (100 − zéro-coupon − marges) ÷ prix du call. */
export function participation(tauxPct: number, annees: number, prixCallPct: number, margesPct: number, protectionPct = 100): number {
  const budget = 100 - protectionPct * facteurActualisation(tauxPct, annees) - margesPct;
  return (budget / prixCallPct) * 100;
}

/** Remboursement d'un capital garanti à l'échéance : protection + participation × hausse (jamais moins que la protection). */
export function rembourseCapitalGaranti(participationPct: number, niveauFinalPct: number, protectionPct = 100): number {
  return protectionPct + (participationPct / 100) * Math.max(niveauFinalPct - 100, 0);
}

export interface ResultatAutocall {
  flux: number[]; // flux versé à chaque date d'observation (0 si rien)
  fin: number; // numéro de la dernière date (rappel ou échéance)
  rappel: boolean; // remboursé par anticipation
  perte: boolean; // capital entamé à l'échéance
  total: number; // somme des flux
}

/**
 * Autocall et Phoenix, une observation par date.
 * - Coupon versé si le niveau ≥ barrière de coupon (avec mémoire : les coupons manqués sont rattrapés).
 * - Rappel anticipé si le niveau ≥ seuil de rappel (sauf à la dernière date).
 * - À l'échéance : 100 si le niveau ≥ barrière de capital, sinon le niveau (perte comme l'indice).
 * Un Athena est un Phoenix dont la barrière de coupon est égale au seuil de rappel, avec mémoire.
 */
export function phoenix(niveaux: number[], couponPct: number, barriereCouponPct: number, seuilRappelPct: number, barriereCapitalPct: number, memoire: boolean): ResultatAutocall {
  const flux: number[] = [];
  let manques = 0;
  for (let t = 0; t < niveaux.length; t++) {
    const n = niveaux[t];
    let f = 0;
    if (n >= barriereCouponPct) {
      f += couponPct * (1 + (memoire ? manques : 0));
      manques = 0;
    } else manques++;
    const derniere = t === niveaux.length - 1;
    if (!derniere && n >= seuilRappelPct) {
      flux.push(f + 100);
      return { flux, fin: t + 1, rappel: true, perte: false, total: flux.reduce((a, b) => a + b, 0) };
    }
    if (derniere) {
      const capital = n >= barriereCapitalPct ? 100 : n;
      flux.push(f + capital);
      return { flux, fin: t + 1, rappel: false, perte: capital < 100, total: flux.reduce((a, b) => a + b, 0) };
    }
    flux.push(f);
  }
  return { flux, fin: 0, rappel: false, perte: false, total: 0 };
}

/** Remboursement d'un reverse convertible : coupon garanti + 100 si l'indice finit au-dessus de la barrière, sinon le niveau de l'indice. */
export function reverseConvertible(couponPct: number, barrierePct: number, niveauFinalPct: number): number {
  return couponPct + (niveauFinalPct >= barrierePct ? 100 : niveauFinalPct);
}

/** Coupon d'un range accrual : taux maximal × part des jours passés dans la fourchette, en %. */
export function rangeAccrual(tauxMaxPct: number, joursDedans: number, joursTotal: number): number {
  return (tauxMaxPct * joursDedans) / joursTotal;
}

/** Rendement annuel équivalent, en %, d'un montant final reçu après n années pour un montant initial. */
export function rendementAnnuel(final: number, initial: number, annees: number): number {
  return (Math.pow(final / initial, 1 / annees) - 1) * 100;
}
