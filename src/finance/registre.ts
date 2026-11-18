// Registre des fonctions utilisables dans le champ « verif » des exercices :
// le script de validation recalcule chaque résultat avec ces fonctions.
import * as fx from './fx';
import * as inflation from './inflation';
import * as taux from './taux';
import * as opt from './options';
import * as st from './structures';

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
  // Module 3 : taux en %, durées en années
  'taux.interetsSimples': taux.interetsSimples,
  'taux.valeurAcquise': taux.valeurAcquise,
  'taux.tauxActuariel': taux.tauxActuariel,
  'taux.facteurActualisation': taux.facteurActualisation,
  'taux.valeurActuelle': taux.valeurActuelle,
  'taux.prixZeroCoupon': taux.prixZeroCoupon,
  'taux.rendementObligation': taux.rendementObligation,
  'taux.durationMacaulay': taux.durationMacaulay,
  'taux.sensibilite': taux.sensibilite,
  'taux.dv01': taux.dv01,
  'taux.convexite': taux.convexite,
  'taux.variationPrixApprochee': taux.variationPrixApprochee,
  'taux.variationPrixExacte': taux.variationPrixExacte,
  'taux.tauxForward': taux.tauxForward,
  'taux.probaDefaut': taux.probaDefaut,
  'taux.annuite': taux.annuite,
  'taux.tauxSwap': taux.tauxSwap,
  'taux.valeurSwapPayeur': taux.valeurSwapPayeur,
  'taux.fluxSwap': taux.fluxSwap,
  'taux.coutAvecCap': taux.coutAvecCap,
  'taux.coutAvecTunnel': taux.coutAvecTunnel,
  'taux.prixFutureTaux': taux.prixFutureTaux,
  // Caplet (Black) : nominal, forward, strike, échéance du fixing, taux d'actualisation, volatilité, jours de la période
  'taux.caplet': (nominal, F, K, T, r, s, jours) => nominal * (jours / 360) * opt.black76('call', F, K, T, r, s),
  // Module 4
  'fx.coursTerme': fx.coursTerme,
  'fx.pointsTerme': fx.pointsTerme,
  'fx.coutImportateurOption': fx.coutImportateurOption,
  'fx.exportateurTunnel': fx.exportateurTunnel,
  'fx.exportateurParticipatif': fx.exportateurParticipatif,
  'fx.rendementCarry': fx.rendementCarry,
  // Module 5
  'structures.participation': st.participation,
  'structures.rembourseCapitalGaranti': st.rembourseCapitalGaranti,
  'structures.reverseConvertible': st.reverseConvertible,
  'structures.rangeAccrual': st.rangeAccrual,
  'structures.rendementAnnuel': st.rendementAnnuel,
  // args = coupon, barrière de coupon, seuil de rappel, barrière de capital, mémoire (1 ou 0), puis les niveaux observés
  'structures.phoenixTotal': (c, bc, sr, bk, m, ...niveaux) => st.phoenix(niveaux, c, bc, sr, bk, m === 1).total,
  // somme pondérée : args = poids1, hausse1, poids2, hausse2, …
  'inflation.inflationPonderee': (...a: number[]) => {
    const postes = [];
    for (let i = 0; i < a.length; i += 2) postes.push({ poids: a[i], hausse: a[i + 1] });
    return inflation.inflationPonderee(postes);
  },
};
