// Registre des fonctions utilisables dans le champ « verif » des exercices :
// le script de validation recalcule chaque résultat avec ces fonctions.
import * as fx from './fx';
import * as inflation from './inflation';
import * as taux from './taux';

export const REGISTRE: Record<string, (...a: number[]) => number> = {
  'fx.usdVersEur': fx.usdVersEur,
  'fx.eurVersUsd': fx.eurVersUsd,
  'fx.ecartEur': fx.ecartEur,
  'fx.valeurPips': fx.valeurPips,
  'fx.coutFourchette': fx.coutFourchette,
  'fx.variationPct': fx.variationPct,
  'inflation.inflationAnnuelle': inflation.inflationAnnuelle,
  'inflation.contribution': inflation.contribution,
  'inflation.pouvoirAchat': inflation.pouvoirAchat,
  'inflation.niveauPrix': inflation.niveauPrix,
  'inflation.tauxReelApproche': inflation.tauxReelApproche,
  'inflation.tauxReelExact': inflation.tauxReelExact,
  'taux.prixObligation': taux.prixObligation,
  'taux.mensualite': taux.mensualite,
  'taux.coutCredit': taux.coutCredit,
  'taux.regleTaylor': taux.regleTaylor,
  'taux.ecartPb': taux.ecartPb,
  'taux.annualiser': taux.annualiser,
  'taux.interets': taux.interets,
  'taux.detteSuivante': taux.detteSuivante,
  // somme pondérée : args = poids1, hausse1, poids2, hausse2, …
  'inflation.inflationPonderee': (...a: number[]) => {
    const postes = [];
    for (let i = 0; i < a.length; i += 2) postes.push({ poids: a[i], hausse: a[i + 1] });
    return inflation.inflationPonderee(postes);
  },
};
