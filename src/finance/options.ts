// Calculs d'options : Black-Scholes et grecques, Black (taux), Garman-Kohlhagen (change),
// volatilité implicite, arbre binomial, Monte Carlo, digitales, barrières, asiatiques.
// Conventions : taux et volatilités en décimal (0,03 = 3 %), maturité en années, taux continus.

export type Sens = 'call' | 'put';

/** Fonction de répartition de la loi normale centrée réduite (algorithme de Hart, précision ~1e-14). */
export function N(x: number): number {
  const a = Math.abs(x);
  let c: number;
  if (a > 37) c = 0;
  else {
    const e = Math.exp((-a * a) / 2);
    if (a < 7.07106781186547) {
      let b = 3.52624965998911e-2 * a + 0.700383064443688;
      b = b * a + 6.37396220353165;
      b = b * a + 33.912866078383;
      b = b * a + 112.079291497871;
      b = b * a + 221.213596169931;
      b = b * a + 220.206867912376;
      c = e * b;
      b = 8.83883476483184e-2 * a + 1.75566716318264;
      b = b * a + 16.064177579207;
      b = b * a + 86.7807322029461;
      b = b * a + 296.564248779674;
      b = b * a + 637.333633378831;
      b = b * a + 793.826512519948;
      b = b * a + 440.413735824752;
      c = c / b;
    } else {
      let b = a + 0.65;
      b = a + 4 / b;
      b = a + 3 / b;
      b = a + 2 / b;
      b = a + 1 / b;
      c = e / b / 2.506628274631;
    }
  }
  return x > 0 ? 1 - c : c;
}

/** Densité de la loi normale centrée réduite. */
export const phi = (x: number) => Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);

export interface Parametres {
  S: number; // prix du sous-jacent (ou cours de change, ou prix à terme pour Black)
  K: number; // strike
  T: number; // maturité en années
  r: number; // taux sans risque continu
  sigma: number; // volatilité annuelle
  q?: number; // rendement continu du sous-jacent : dividende, ou taux étranger en change
}

export interface Resultat {
  prix: number;
  d1: number;
  d2: number;
  delta: number;
  gamma: number;
  vega: number; // pour +1 (100 points) de volatilité ; diviser par 100 pour 1 point
  theta: number; // par an ; diviser par 365 pour un jour
  rho: number; // pour +1 (100 %) de taux ; diviser par 100 pour 1 point
}

/** Black-Scholes-Merton avec rendement continu q (q = 0 : Black-Scholes ; q = taux étranger : Garman-Kohlhagen). */
export function bs(sens: Sens, { S, K, T, r, sigma, q = 0 }: Parametres): Resultat {
  if (T <= 1e-10 || sigma <= 1e-10) {
    // À l'échéance (ou sans volatilité) : valeur intrinsèque sur le prix à terme actualisé.
    const Fwd = S * Math.exp((r - q) * Math.max(T, 0));
    const disc = Math.exp(-r * Math.max(T, 0));
    const dansLaMonnaie = sens === 'call' ? Fwd > K : Fwd < K;
    const prix = disc * Math.max(sens === 'call' ? Fwd - K : K - Fwd, 0);
    const delta = dansLaMonnaie ? (sens === 'call' ? 1 : -1) * Math.exp(-q * Math.max(T, 0)) : 0;
    return { prix, d1: NaN, d2: NaN, delta, gamma: 0, vega: 0, theta: 0, rho: 0 };
  }
  const rt = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + (sigma * sigma) / 2) * T) / (sigma * rt);
  const d2 = d1 - sigma * rt;
  const eq = Math.exp(-q * T);
  const er = Math.exp(-r * T);
  const gamma = (eq * phi(d1)) / (S * sigma * rt);
  const vega = S * eq * phi(d1) * rt;
  const thetaCommun = (-S * eq * phi(d1) * sigma) / (2 * rt);
  if (sens === 'call') {
    return {
      prix: S * eq * N(d1) - K * er * N(d2),
      d1, d2,
      delta: eq * N(d1),
      gamma, vega,
      theta: thetaCommun - r * K * er * N(d2) + q * S * eq * N(d1),
      rho: K * T * er * N(d2),
    };
  }
  return {
    prix: K * er * N(-d2) - S * eq * N(-d1),
    d1, d2,
    delta: eq * (N(d1) - 1),
    gamma, vega,
    theta: thetaCommun + r * K * er * N(-d2) - q * S * eq * N(-d1),
    rho: -K * T * er * N(-d2),
  };
}

/** Modèle de Black (1976) : option sur un prix à terme F (taux, matières premières). */
export function black76(sens: Sens, F: number, K: number, T: number, r: number, sigma: number): number {
  return bs(sens, { S: F, K, T, r, sigma, q: r }).prix;
}

/** Garman-Kohlhagen : option de change. S en devise domestique pour 1 unité de devise étrangère. */
export function garmanKohlhagen(sens: Sens, S: number, K: number, T: number, rDom: number, rEtr: number, sigma: number): number {
  return bs(sens, { S, K, T, r: rDom, sigma, q: rEtr }).prix;
}

/** Ordre de grandeur d'une option à la monnaie : 0,4 × S × σ × √T. */
export const approxATM = (S: number, sigma: number, T: number) => 0.4 * S * sigma * Math.sqrt(T);

/** Parité call-put : C − P = S·e^(−qT) − K·e^(−rT). */
export const pariteCallPut = (S: number, K: number, T: number, r: number, q = 0) => S * Math.exp(-q * T) - K * Math.exp(-r * T);

/** Volatilité implicite : la volatilité qui redonne le prix observé (Newton, puis dichotomie si besoin). */
export function volImplicite(sens: Sens, prix: number, S: number, K: number, T: number, r: number, q = 0): number {
  const p = (s: number) => bs(sens, { S, K, T, r, sigma: s, q }).prix;
  let lo = 1e-4, hi = 5;
  if (prix <= p(lo) || prix >= p(hi)) return NaN;
  let s = Math.max(0.05, Math.min(2, (Math.sqrt((2 * Math.PI) / T) * prix) / S));
  for (let i = 0; i < 50; i++) {
    const r1 = bs(sens, { S, K, T, r, sigma: s, q });
    const ecart = r1.prix - prix;
    if (Math.abs(ecart) < 1e-10) return s;
    if (ecart > 0) hi = Math.min(hi, s); else lo = Math.max(lo, s);
    const suivant = r1.vega > 1e-8 ? s - ecart / r1.vega : NaN;
    s = suivant > lo && suivant < hi ? suivant : (lo + hi) / 2;
  }
  return s;
}

/* ---------- Arbre binomial (Cox-Ross-Rubinstein) ---------- */
export interface Arbre {
  prix: number;
  u: number; d: number; p: number; dt: number;
  S: number[][]; // S[i][j] : prix du sous-jacent à l'étape i après j hausses
  V: number[][]; // valeur de l'option au même nœud
  exerce: boolean[][]; // vrai si l'exercice anticipé est optimal à ce nœud
}

export function arbreBinomial(sens: Sens, S0: number, K: number, T: number, r: number, sigma: number, n: number, americaine: boolean, q = 0): Arbre {
  const dt = T / n;
  const u = Math.exp(sigma * Math.sqrt(dt));
  const d = 1 / u;
  const p = (Math.exp((r - q) * dt) - d) / (u - d);
  const disc = Math.exp(-r * dt);
  const gain = (s: number) => Math.max(sens === 'call' ? s - K : K - s, 0);
  const S: number[][] = [], V: number[][] = [], exerce: boolean[][] = [];
  for (let i = 0; i <= n; i++) S.push(Array.from({ length: i + 1 }, (_, j) => S0 * Math.pow(u, j) * Math.pow(d, i - j)));
  V[n] = S[n].map(gain);
  exerce[n] = S[n].map((s) => gain(s) > 0);
  for (let i = n - 1; i >= 0; i--) {
    V[i] = []; exerce[i] = [];
    for (let j = 0; j <= i; j++) {
      const continuation = disc * (p * V[i + 1][j + 1] + (1 - p) * V[i + 1][j]);
      const immediat = gain(S[i][j]);
      const anticipe = americaine && immediat > continuation + 1e-12;
      V[i][j] = anticipe ? immediat : continuation;
      exerce[i][j] = anticipe;
    }
  }
  return { prix: V[0][0], u, d, p, dt, S, V, exerce };
}

/** Prix seul, sans conserver l'arbre (pour les grands nombres d'étapes). */
export function binomial(sens: Sens, S0: number, K: number, T: number, r: number, sigma: number, n: number, americaine: boolean, q = 0): number {
  const dt = T / n;
  const u = Math.exp(sigma * Math.sqrt(dt));
  const d = 1 / u;
  const p = (Math.exp((r - q) * dt) - d) / (u - d);
  const disc = Math.exp(-r * dt);
  const gain = (s: number) => Math.max(sens === 'call' ? s - K : K - s, 0);
  const v = Array.from({ length: n + 1 }, (_, j) => gain(S0 * Math.pow(u, 2 * j - n)));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = 0; j <= i; j++) {
      const c = disc * (p * v[j + 1] + (1 - p) * v[j]);
      v[j] = americaine ? Math.max(c, gain(S0 * Math.pow(u, 2 * j - i))) : c;
    }
  }
  return v[0];
}

/* ---------- Monte Carlo ---------- */
/** Générateur pseudo-aléatoire reproductible (mulberry32). */
export function generateur(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tirage gaussien (Box-Muller) à partir d'un générateur uniforme. */
export function gaussien(alea: () => number): () => number {
  let reserve: number | null = null;
  return () => {
    if (reserve !== null) { const z = reserve; reserve = null; return z; }
    let u = 0;
    while (u <= 1e-12) u = alea();
    const v = alea();
    const rayon = Math.sqrt(-2 * Math.log(u));
    reserve = rayon * Math.sin(2 * Math.PI * v);
    return rayon * Math.cos(2 * Math.PI * v);
  };
}

/** Un prix final simulé sous la probabilité risque-neutre. */
export const prixFinal = (S: number, T: number, r: number, sigma: number, z: number, q = 0) =>
  S * Math.exp((r - q - (sigma * sigma) / 2) * T + sigma * Math.sqrt(T) * z);

export interface EstimationMC { prix: number; erreur: number; n: number }

/** Option européenne par Monte Carlo : moyenne des gains actualisés et marge d'erreur (un écart-type). */
export function monteCarlo(sens: Sens, S: number, K: number, T: number, r: number, sigma: number, n: number, graine = 1, q = 0): EstimationMC {
  const z = gaussien(generateur(graine));
  const disc = Math.exp(-r * T);
  let somme = 0, sommeCarres = 0;
  for (let i = 0; i < n; i++) {
    const st = prixFinal(S, T, r, sigma, z(), q);
    const g = disc * Math.max(sens === 'call' ? st - K : K - st, 0);
    somme += g; sommeCarres += g * g;
  }
  const moyenne = somme / n;
  const variance = Math.max(sommeCarres / n - moyenne * moyenne, 0);
  return { prix: moyenne, erreur: Math.sqrt(variance / n), n };
}

/** Marge d'erreur d'une moyenne de n tirages : écart-type / √n. */
export const erreurMC = (ecartType: number, n: number) => ecartType / Math.sqrt(n);

/* ---------- Exotiques ---------- */
/** Digitale « cash or nothing » : paie 1 si l'option finit dans la monnaie. */
export function digitale(sens: Sens, { S, K, T, r, sigma, q = 0 }: Parametres): number {
  const { d2 } = bs('call', { S, K, T, r, sigma, q });
  return Math.exp(-r * T) * N(sens === 'call' ? d2 : -d2);
}

/** Put « down-and-in » : put qui n'existe que si le sous-jacent touche la barrière H (< S et ≤ K), surveillance continue. */
export function putDownIn({ S, K, T, r, sigma, q = 0 }: Parametres, H: number): number {
  if (S <= H) return bs('put', { S, K, T, r, sigma, q }).prix;
  const st = sigma * Math.sqrt(T);
  const l = (r - q + (sigma * sigma) / 2) / (sigma * sigma);
  const y = Math.log((H * H) / (S * K)) / st + l * st;
  const x1 = Math.log(S / H) / st + l * st;
  const y1 = Math.log(H / S) / st + l * st;
  const eq = Math.exp(-q * T), er = Math.exp(-r * T);
  const a = Math.pow(H / S, 2 * l), b = Math.pow(H / S, 2 * l - 2);
  return -S * N(-x1) * eq + K * er * N(-x1 + st) + S * eq * a * (N(y) - N(y1)) - K * er * b * (N(y - st) - N(y1 - st));
}

/** Put « down-and-out » : la parité in-out donne vanille = in + out. */
export const putDownOut = (p: Parametres, H: number) => bs('put', p).prix - putDownIn(p, H);

/** Asiatique à moyenne géométrique continue (Kemna-Vorst) : volatilité σ/√3 et dérive ajustée. */
export function asiatiqueGeometrique(sens: Sens, { S, K, T, r, sigma, q = 0 }: Parametres): number {
  const sA = sigma / Math.sqrt(3);
  const bA = 0.5 * (r - q - (sigma * sigma) / 6);
  // Une option sur la moyenne = Black-Scholes avec la volatilité sA et un rendement qA tel que r − qA = bA.
  return bs(sens, { S, K, T, r, sigma: sA, q: r - bA }).prix;
}

/* ---------- Grecques par « bump and reprice » ---------- */
/** Delta par différence finie centrée : on décale le sous-jacent de ±h et on recalcule le prix. */
export function deltaBump(sens: Sens, p: Parametres, h: number): number {
  return (bs(sens, { ...p, S: p.S + h }).prix - bs(sens, { ...p, S: p.S - h }).prix) / (2 * h);
}
export function gammaBump(sens: Sens, p: Parametres, h: number): number {
  return (bs(sens, { ...p, S: p.S + h }).prix - 2 * bs(sens, p).prix + bs(sens, { ...p, S: p.S - h }).prix) / (h * h);
}

/* ---------- Couverture et volatilité réalisée ---------- */
/** Résultat d'une journée pour une option couverte en delta : ½ Γ (ΔS)² + Θ. */
export const pnlCouvert = (gamma: number, dS: number, thetaJour: number) => 0.5 * gamma * dS * dS + thetaJour;

/** Volatilité réalisée annualisée à partir d'une série de cours (rendements logarithmiques, 252 jours). */
export function volRealisee(cours: number[], joursParAn = 252): number {
  const r = cours.slice(1).map((c, i) => Math.log(c / cours[i]));
  const m = r.reduce((s, x) => s + x, 0) / r.length;
  const v = r.reduce((s, x) => s + (x - m) * (x - m), 0) / (r.length - 1);
  return Math.sqrt(v * joursParAn);
}

/* ---------- Stratégies ---------- */
export interface Jambe { type: Sens | 'sous-jacent'; K?: number; quantite: number } // quantité > 0 : achat ; < 0 : vente

/** Gain à l'échéance d'une combinaison, hors prime. */
export function gainEcheance(jambes: Jambe[], ST: number, S0 = 0): number {
  return jambes.reduce((s, j) => {
    if (j.type === 'sous-jacent') return s + j.quantite * (ST - S0);
    const g = j.type === 'call' ? Math.max(ST - (j.K ?? 0), 0) : Math.max((j.K ?? 0) - ST, 0);
    return s + j.quantite * g;
  }, 0);
}

/** Valeur aujourd'hui d'une combinaison d'options (Black-Scholes), sous-jacent compté pour S − S0. */
export function valeurStrategie(jambes: Jambe[], p: Omit<Parametres, 'K'>, S0 = p.S): number {
  return jambes.reduce((s, j) => {
    if (j.type === 'sous-jacent') return s + j.quantite * (p.S - S0);
    return s + j.quantite * bs(j.type, { ...p, K: j.K ?? 0 }).prix;
  }, 0);
}
