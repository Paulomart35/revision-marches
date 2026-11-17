// Registre des fonctions utilisables dans le champ « verif » des exercices :
// le script de validation recalcule chaque résultat avec ces fonctions.
import * as fx from './fx';
import * as inflation from './inflation';
import * as taux from './taux';
import * as opt from './options';

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
  // Options : S, K, T, r, σ (taux et volatilité en décimal)
  'options.call': (S, K, T, r, s) => opt.bs('call', { S, K, T, r, sigma: s }).prix,
  'options.put': (S, K, T, r, s) => opt.bs('put', { S, K, T, r, sigma: s }).prix,
  'options.d1': (S, K, T, r, s) => opt.bs('call', { S, K, T, r, sigma: s }).d1,
  'options.d2': (S, K, T, r, s) => opt.bs('call', { S, K, T, r, sigma: s }).d2,
  'options.N': (x) => opt.N(x),
  'options.deltaCall': (S, K, T, r, s) => opt.bs('call', { S, K, T, r, sigma: s }).delta,
  'options.deltaPut': (S, K, T, r, s) => opt.bs('put', { S, K, T, r, sigma: s }).delta,
  'options.gamma': (S, K, T, r, s) => opt.bs('call', { S, K, T, r, sigma: s }).gamma,
  'options.vegaPoint': (S, K, T, r, s) => opt.bs('call', { S, K, T, r, sigma: s }).vega / 100,
  'options.thetaJourCall': (S, K, T, r, s) => opt.bs('call', { S, K, T, r, sigma: s }).theta / 365,
  'options.thetaBourseCall': (S, K, T, r, s) => opt.bs('call', { S, K, T, r, sigma: s }).theta / 252,
  'options.rhoPointCall': (S, K, T, r, s) => opt.bs('call', { S, K, T, r, sigma: s }).rho / 100,
  'options.parite': (S, K, T, r) => opt.pariteCallPut(S, K, T, r),
  'options.approxATM': (S, s, T) => opt.approxATM(S, s, T),
  'options.black76Call': (F, K, T, r, s) => opt.black76('call', F, K, T, r, s),
  'options.gkCall': (S, K, T, rd, rf, s) => opt.garmanKohlhagen('call', S, K, T, rd, rf, s),
  'options.gkPut': (S, K, T, rd, rf, s) => opt.garmanKohlhagen('put', S, K, T, rd, rf, s),
  'options.binomialPutAm': (S, K, T, r, s, n) => opt.binomial('put', S, K, T, r, s, n, true),
  'options.binomialPutEu': (S, K, T, r, s, n) => opt.binomial('put', S, K, T, r, s, n, false),
  'options.binomialCallEu': (S, K, T, r, s, n) => opt.binomial('call', S, K, T, r, s, n, false),
  'options.digitaleCall': (S, K, T, r, s) => opt.digitale('call', { S, K, T, r, sigma: s }),
  'options.putDownIn': (S, K, H, T, r, s) => opt.putDownIn({ S, K, T, r, sigma: s }, H),
  'options.putDownOut': (S, K, H, T, r, s) => opt.putDownOut({ S, K, T, r, sigma: s }, H),
  'options.pnlCouvert': (g, dS, th) => opt.pnlCouvert(g, dS, th),
  'options.volImpliciteCall': (prix, S, K, T, r) => opt.volImplicite('call', prix, S, K, T, r),
  'options.erreurMC': (e, n) => opt.erreurMC(e, n),
  'options.deltaBumpCall': (S, K, T, r, s, h) => opt.deltaBump('call', { S, K, T, r, sigma: s }, h),
  'options.asiatiqueCall': (S, K, T, r, s) => opt.asiatiqueGeometrique('call', { S, K, T, r, sigma: s }),
  // somme pondérée : args = poids1, hausse1, poids2, hausse2, …
  'inflation.inflationPonderee': (...a: number[]) => {
    const postes = [];
    for (let i = 0; i < a.length; i += 2) postes.push({ poids: a[i], hausse: a[i + 1] });
    return inflation.inflationPonderee(postes);
  },
};
