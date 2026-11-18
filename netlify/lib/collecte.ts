// Collecte quotidienne des chiffres de marché auprès de sources officielles gratuites.
// - BCE (portail de données, sans clé) : taux directeurs, €STR, Euribor (moyenne mensuelle), taux de change, taux à 10 ans.
// - Eurostat (API de diffusion, sans clé) : inflation de la zone euro (IPCH, nomenclature ECOICOP 2 depuis 2026).
// - FRED, Fed de Saint-Louis : Fed funds, inflation américaine (BLS), Treasury 10 ans, Brent (EIA).
//   Avec la variable d'environnement FRED_API_KEY, on passe par l'API officielle ; sinon par le téléchargement CSV public.
// Règle : si une source ne répond pas, on garde la dernière valeur connue, marquée « ancienne ».

export type Groupe = 'Banques centrales' | 'Taux courts' | 'Inflation' | 'Change' | 'Taux longs' | 'Matières premières';

export interface Observation { date: string; valeur: number }

export interface Serie {
  cle: string;
  groupe: Groupe;
  libelle: string;
  unite: '%' | 'pb' | '' | '$';
  decimales: number;
  valeur: number;
  texte?: string; // affichage particulier (fourchette des Fed funds)
  date: string; // date de la valeur : AAAA-MM-JJ ou AAAA-MM
  precedent?: Observation;
  frequence: 'quotidienne' | 'mensuelle';
  source: string;
  url: string;
  definition: string;
  pourquoi: string;
  note?: string;
  releve_le: string; // date et heure de la dernière collecte réussie
  statut: 'ok' | 'ancien';
  erreur?: string;
}

export interface Marche { genere_le: string; series: Record<string, Serie>; erreurs: number; details_erreurs?: Record<string, string> }

type Recuperer = (url: string) => Promise<string>;

/* ---------- Lecture des formats ---------- */
/** CSV de la BCE (format=csvdata) : colonnes TIME_PERIOD et OBS_VALUE. */
export function lireCsvBce(texte: string): Observation[] {
  const lignes = texte.trim().split(/\r?\n/);
  const entete = decouperCsv(lignes[0]);
  const iT = entete.indexOf('TIME_PERIOD'), iV = entete.indexOf('OBS_VALUE');
  if (iT < 0 || iV < 0) throw new Error('CSV BCE inattendu');
  return lignes.slice(1).map(decouperCsv)
    .map((c) => ({ date: c[iT], valeur: Number(c[iV]) }))
    .filter((o) => o.date && c(o.valeur));
}

/** CSV de FRED (fredgraph.csv) : date, valeur ; les valeurs manquantes sont vides ou « . ». */
export function lireCsvFred(texte: string): Observation[] {
  return texte.trim().split(/\r?\n/).slice(1).map((l) => l.split(','))
    .map(([d, v]) => ({ date: d, valeur: v === '' || v === '.' ? NaN : Number(v) }))
    .filter((o) => o.date && c(o.valeur));
}

/** JSON de l'API FRED (series/observations). */
export function lireJsonFred(texte: string): Observation[] {
  const j = JSON.parse(texte) as { observations?: { date: string; value: string }[] };
  if (!j.observations) throw new Error('JSON FRED inattendu');
  return j.observations.map((o) => ({ date: o.date, valeur: o.value === '.' ? NaN : Number(o.value) })).filter((o) => c(o.valeur));
}

/** JSON-stat d'Eurostat filtré sur une seule série : une valeur par période ; renvoie aussi les statuts (« e » = estimation). */
export function lireEurostat(texte: string): (Observation & { statut?: string })[] {
  const j = JSON.parse(texte) as { value: Record<string, number>; status?: Record<string, string>; dimension: { time: { category: { index: Record<string, number> } } }; size: number[] };
  const temps = j.dimension.time.category.index;
  const parIndex = Object.fromEntries(Object.entries(temps).map(([d, i]) => [i, d]));
  return Object.entries(j.value)
    .map(([i, v]) => ({ date: parIndex[Number(i)], valeur: v, statut: j.status?.[i] }))
    .filter((o) => o.date && c(o.valeur))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function decouperCsv(ligne: string): string[] {
  const res: string[] = [];
  let cur = '', guillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const ch = ligne[i];
    if (ch === '"') { if (guillemets && ligne[i + 1] === '"') { cur += '"'; i++; } else guillemets = !guillemets; }
    else if (ch === ',' && !guillemets) { res.push(cur); cur = ''; }
    else cur += ch;
  }
  res.push(cur);
  return res;
}

const c = (v: number) => Number.isFinite(v);

/** Glissement annuel d'un indice mensuel : dernier mois pour lequel le même mois de l'année précédente existe. */
export function glissementAnnuel(obs: Observation[]): { courant: Observation; precedent?: Observation; note?: string } {
  const parDate = new Map(obs.map((o) => [o.date.slice(0, 7), o.valeur]));
  const calculs = obs.map((o) => {
    const [a, m] = o.date.slice(0, 7).split('-').map(Number);
    const avant = parDate.get(`${a - 1}-${String(m).padStart(2, '0')}`);
    return avant ? { date: o.date.slice(0, 7), valeur: (o.valeur / avant - 1) * 100 } : null;
  }).filter((x): x is Observation => x !== null);
  if (!calculs.length) throw new Error("pas assez d'historique pour un glissement annuel");
  const courant = calculs[calculs.length - 1];
  const dernierIndice = obs[obs.length - 1].date.slice(0, 7);
  const note = dernierIndice !== courant.date
    ? `L'indice de ${moisFr(dernierIndice)} est publié, mais pas son glissement annuel : la valeur du même mois de l'année précédente manque (relevé non collecté).`
    : undefined;
  return { courant, precedent: calculs[calculs.length - 2], note };
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const moisFr = (am: string) => { const [a, m] = am.split('-').map(Number); return `${MOIS[m - 1]} ${a}`; };

/* ---------- Les sources ---------- */
const BCE = (cle: string, n = 3) => `https://data-api.ecb.europa.eu/service/data/${cle}?lastNObservations=${n}&format=csvdata`;
const BCE_PAGE = (cle: string) => `https://data.ecb.europa.eu/data/datasets/${cle.split('/')[0]}/${cle.replace('/', '.')}`;
const EUROSTAT = (coicop: string) => `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_minr?geo=EA&unit=RCH_A&coicop18=${coicop}&lastTimePeriod=3&lang=EN`;
const EUROSTAT_PAGE = 'https://ec.europa.eu/eurostat/databrowser/view/prc_hicp_minr/default/table';
const FRED_PAGE = (id: string) => `https://fred.stlouisfed.org/series/${id}`;

function debutFred(mois: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - mois);
  return d.toISOString().slice(0, 10);
}

async function fred(recuperer: Recuperer, id: string, depuisMois: number, cle?: string): Promise<Observation[]> {
  const debut = debutFred(depuisMois);
  if (cle) return lireJsonFred(await recuperer(`https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${cle}&file_type=json&observation_start=${debut}`));
  return lireCsvFred(await recuperer(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${debut}`));
}

type Partiel = Omit<Serie, 'releve_le' | 'statut' | 'erreur'>;
interface Definition {
  cle: string; groupe: Groupe; libelle: string; unite: Serie['unite']; decimales: number; frequence: Serie['frequence'];
  source: string; url: string; definition: string; pourquoi: string;
  obtenir: (r: Recuperer, fredCle?: string, deja?: Record<string, Partiel>) => Promise<Pick<Serie, 'valeur' | 'date' | 'precedent' | 'texte' | 'note'>>;
}

const dernieres = (obs: Observation[]) => {
  if (!obs.length) throw new Error('aucune observation');
  return { valeur: obs[obs.length - 1].valeur, date: obs[obs.length - 1].date, precedent: obs[obs.length - 2] };
};

const bce = (cle: string) => async (r: Recuperer) => dernieres(lireCsvBce(await r(BCE(cle))));

/** Le taux directeur de la BCE est publié chaque jour : on cherche la dernière valeur différente pour le « précédent ». */
const tauxBce = (cle: string) => async (r: Recuperer) => {
  const obs = lireCsvBce(await r(`https://data-api.ecb.europa.eu/service/data/${cle}?startPeriod=${debutFred(30)}&format=csvdata`));
  const d = dernieres(obs);
  const change = [...obs].reverse().find((o) => o.valeur !== d.valeur);
  const depuis = change ? obs[obs.indexOf(change) + 1] : undefined;
  return { ...d, precedent: change, note: depuis ? `Niveau en vigueur depuis le ${depuis.date}.` : undefined };
};

const eurostat = (coicop: string) => async (r: Recuperer) => {
  const obs = lireEurostat(await r(EUROSTAT(coicop)));
  const d = dernieres(obs);
  const statut = obs[obs.length - 1].statut;
  return { ...d, note: statut === 'e' ? 'Estimation rapide d’Eurostat, révisable lors de la publication définitive.' : undefined };
};

export const DEFINITIONS: Definition[] = [
  { cle: 'bce-depot', groupe: 'Banques centrales', libelle: 'BCE, taux de dépôt', unite: '%', decimales: 2, frequence: 'quotidienne', source: 'BCE', url: BCE_PAGE('FM/D.U2.EUR.4F.KR.DFR.LEV'),
    definition: 'Taux auquel la BCE rémunère les dépôts des banques. C’est son taux directeur principal.', pourquoi: 'Il fixe le niveau de tous les taux courts en euros : €STR, Euribor, crédits à taux variable.',
    obtenir: tauxBce('FM/D.U2.EUR.4F.KR.DFR.LEV') },
  { cle: 'bce-refi', groupe: 'Banques centrales', libelle: 'BCE, taux de refinancement', unite: '%', decimales: 2, frequence: 'quotidienne', source: 'BCE', url: BCE_PAGE('FM/D.U2.EUR.4F.KR.MRR_FR.LEV'),
    definition: 'Taux des prêts hebdomadaires de la BCE aux banques.', pourquoi: 'C’est le milieu du corridor des taux directeurs.',
    obtenir: tauxBce('FM/D.U2.EUR.4F.KR.MRR_FR.LEV') },
  { cle: 'bce-pret', groupe: 'Banques centrales', libelle: 'BCE, taux de prêt marginal', unite: '%', decimales: 2, frequence: 'quotidienne', source: 'BCE', url: BCE_PAGE('FM/D.U2.EUR.4F.KR.MLFR.LEV'),
    definition: 'Taux des emprunts d’urgence d’une banque à la BCE, pour 24 heures.', pourquoi: 'C’est le plafond du corridor.',
    obtenir: tauxBce('FM/D.U2.EUR.4F.KR.MLFR.LEV') },
  { cle: 'fed-funds', groupe: 'Banques centrales', libelle: 'Fed, fourchette des Fed funds', unite: '%', decimales: 2, frequence: 'quotidienne', source: 'Réserve fédérale, via FRED', url: FRED_PAGE('DFEDTARU'),
    definition: 'Fourchette cible du taux directeur de la banque centrale américaine.', pourquoi: 'L’écart avec le taux de la BCE est le premier moteur de l’EUR/USD.',
    obtenir: async (r, k) => {
      const [haut, bas] = await Promise.all([fred(r, 'DFEDTARU', 30, k), fred(r, 'DFEDTARL', 30, k)]);
      const d = dernieres(haut), b = dernieres(bas);
      const change = [...haut].reverse().find((o) => o.valeur !== d.valeur);
      const fmt = (v: number) => v.toFixed(2).replace('.', ',');
      return { ...d, precedent: change, texte: `${fmt(b.valeur)} % – ${fmt(d.valeur)} %` };
    } },

  { cle: 'estr', groupe: 'Taux courts', libelle: '€STR', unite: '%', decimales: 3, frequence: 'quotidienne', source: 'BCE', url: BCE_PAGE('EST/B.EU000A2X2A25.WT'),
    definition: 'Taux des prêts d’un jour entre banques de la zone euro, calculé par la BCE.', pourquoi: 'C’est la traduction directe de la décision de la BCE sur le marché.',
    obtenir: bce('EST/B.EU000A2X2A25.WT') },
  { cle: 'euribor-3m', groupe: 'Taux courts', libelle: 'Euribor 3 mois (moyenne du mois)', unite: '%', decimales: 3, frequence: 'mensuelle', source: 'EMMI, via la BCE', url: BCE_PAGE('FM/M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA'),
    definition: 'Taux auquel les banques se prêtent à trois mois, en moyenne sur le mois.', pourquoi: 'C’est l’index de la plupart des crédits à taux variable des entreprises.',
    obtenir: bce('FM/M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA') },
  { cle: 'euribor-12m', groupe: 'Taux courts', libelle: 'Euribor 12 mois (moyenne du mois)', unite: '%', decimales: 3, frequence: 'mensuelle', source: 'EMMI, via la BCE', url: BCE_PAGE('FM/M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA'),
    definition: 'Taux auquel les banques se prêtent à un an, en moyenne sur le mois.', pourquoi: 'Son écart avec l’Euribor 3 mois montre les hausses ou baisses de taux attendues.',
    obtenir: bce('FM/M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA') },

  { cle: 'inflation-ze', groupe: 'Inflation', libelle: 'Inflation zone euro, totale', unite: '%', decimales: 1, frequence: 'mensuelle', source: 'Eurostat', url: EUROSTAT_PAGE,
    definition: 'Hausse sur un an de l’indice des prix à la consommation harmonisé (IPCH).', pourquoi: 'C’est l’objectif de la BCE : 2 % à moyen terme.',
    obtenir: eurostat('TOTAL') },
  { cle: 'inflation-ze-core', groupe: 'Inflation', libelle: 'Inflation zone euro, sous-jacente', unite: '%', decimales: 1, frequence: 'mensuelle', source: 'Eurostat', url: EUROSTAT_PAGE,
    definition: 'Inflation hors énergie, alimentation, alcool et tabac.', pourquoi: 'Elle montre si un choc de prix se diffuse à toute l’économie.',
    obtenir: eurostat('TOT_X_NRG_FOOD') },
  { cle: 'inflation-ze-energie', groupe: 'Inflation', libelle: 'Inflation zone euro, énergie', unite: '%', decimales: 1, frequence: 'mensuelle', source: 'Eurostat', url: EUROSTAT_PAGE,
    definition: 'Hausse sur un an des prix de l’énergie dans l’IPCH.', pourquoi: 'C’est le poste le plus volatil, souvent à l’origine des chocs d’inflation.',
    obtenir: eurostat('NRG') },
  { cle: 'inflation-us', groupe: 'Inflation', libelle: 'Inflation États-Unis (CPI)', unite: '%', decimales: 1, frequence: 'mensuelle', source: 'Bureau of Labor Statistics, via FRED', url: FRED_PAGE('CPIAUCNS'),
    definition: 'Hausse sur un an de l’indice américain des prix à la consommation, non corrigé des variations saisonnières.', pourquoi: 'C’est le chiffre d’inflation qui fait le plus réagir les marchés.',
    obtenir: async (r, k) => { const g = glissementAnnuel(await fred(r, 'CPIAUCNS', 30, k)); return { valeur: g.courant.valeur, date: g.courant.date, precedent: g.precedent, note: g.note }; } },
  { cle: 'inflation-us-core', groupe: 'Inflation', libelle: 'Inflation États-Unis, sous-jacente', unite: '%', decimales: 1, frequence: 'mensuelle', source: 'Bureau of Labor Statistics, via FRED', url: FRED_PAGE('CPILFENS'),
    definition: 'CPI hors alimentation et énergie, sur un an.', pourquoi: 'La tendance de fond que surveille la Fed.',
    obtenir: async (r, k) => { const g = glissementAnnuel(await fred(r, 'CPILFENS', 30, k)); return { valeur: g.courant.valeur, date: g.courant.date, precedent: g.precedent, note: g.note }; } },

  { cle: 'eurusd', groupe: 'Change', libelle: 'EUR/USD', unite: '', decimales: 4, frequence: 'quotidienne', source: 'BCE, taux de référence', url: BCE_PAGE('EXR/D.USD.EUR.SP00.A'),
    definition: 'Nombre de dollars pour 1 euro (taux de référence publié vers 16 h, heure de Paris).', pourquoi: 'Un euro faible avantage les exportateurs et renchérit l’énergie importée.',
    obtenir: bce('EXR/D.USD.EUR.SP00.A') },
  { cle: 'eurgbp', groupe: 'Change', libelle: 'EUR/GBP', unite: '', decimales: 4, frequence: 'quotidienne', source: 'BCE, taux de référence', url: BCE_PAGE('EXR/D.GBP.EUR.SP00.A'),
    definition: 'Nombre de livres sterling pour 1 euro.', pourquoi: 'Il compte pour les entreprises qui commercent avec le Royaume-Uni.',
    obtenir: bce('EXR/D.GBP.EUR.SP00.A') },
  { cle: 'eurjpy', groupe: 'Change', libelle: 'EUR/JPY', unite: '', decimales: 2, frequence: 'quotidienne', source: 'BCE, taux de référence', url: BCE_PAGE('EXR/D.JPY.EUR.SP00.A'),
    definition: 'Nombre de yens pour 1 euro.', pourquoi: 'Il reflète l’écart de taux avec le Japon, où les taux restent bas.',
    obtenir: bce('EXR/D.JPY.EUR.SP00.A') },
  { cle: 'usdjpy', groupe: 'Change', libelle: 'USD/JPY (calculé)', unite: '', decimales: 2, frequence: 'quotidienne', source: 'Calculé à partir des taux de référence de la BCE', url: BCE_PAGE('EXR/D.JPY.EUR.SP00.A'),
    definition: 'Nombre de yens pour 1 dollar : EUR/JPY divisé par EUR/USD.', pourquoi: 'S’il monte, le dollar se renforce face au yen.',
    obtenir: async (_r, _k, deja) => {
      const usd = deja?.eurusd, jpy = deja?.eurjpy;
      if (!usd || !jpy || usd.date !== jpy.date) throw new Error('EUR/USD et EUR/JPY indisponibles à la même date');
      const prec = usd.precedent && jpy.precedent && usd.precedent.date === jpy.precedent.date ? { date: usd.precedent.date, valeur: jpy.precedent.valeur / usd.precedent.valeur } : undefined;
      return { valeur: jpy.valeur / usd.valeur, date: usd.date, precedent: prec };
    } },

  { cle: 'oat-10', groupe: 'Taux longs', libelle: 'OAT 10 ans (moyenne du mois)', unite: '%', decimales: 2, frequence: 'mensuelle', source: 'BCE (taux de long terme, critère de Maastricht)', url: BCE_PAGE('IRS/M.FR.L.L40.CI.0000.EUR.N.Z'),
    definition: 'Taux auquel l’État français emprunte à 10 ans, en moyenne sur le mois.', pourquoi: 'C’est le plancher des taux d’emprunt à long terme en France.',
    obtenir: bce('IRS/M.FR.L.L40.CI.0000.EUR.N.Z') },
  { cle: 'bund-10', groupe: 'Taux longs', libelle: 'Bund 10 ans (moyenne du mois)', unite: '%', decimales: 2, frequence: 'mensuelle', source: 'BCE (taux de long terme, critère de Maastricht)', url: BCE_PAGE('IRS/M.DE.L.L40.CI.0000.EUR.N.Z'),
    definition: 'Taux auquel l’État allemand emprunte à 10 ans, en moyenne sur le mois.', pourquoi: 'La référence sans risque de la zone euro.',
    obtenir: bce('IRS/M.DE.L.L40.CI.0000.EUR.N.Z') },
  { cle: 'oat-bund', groupe: 'Taux longs', libelle: 'Écart OAT-Bund (moyenne du mois)', unite: 'pb', decimales: 0, frequence: 'mensuelle', source: 'Calculé à partir des données de la BCE', url: BCE_PAGE('IRS/M.FR.L.L40.CI.0000.EUR.N.Z'),
    definition: 'Différence entre les taux à 10 ans français et allemand, en points de base.', pourquoi: 'Il mesure la prime de risque de la dette française.',
    obtenir: async (_r, _k, deja) => {
      const fr = deja?.['oat-10'], de = deja?.['bund-10'];
      if (!fr || !de || fr.date !== de.date) throw new Error('OAT et Bund indisponibles pour le même mois');
      const prec = fr.precedent && de.precedent && fr.precedent.date === de.precedent.date ? { date: fr.precedent.date, valeur: (fr.precedent.valeur - de.precedent.valeur) * 100 } : undefined;
      return { valeur: (fr.valeur - de.valeur) * 100, date: fr.date, precedent: prec };
    } },
  { cle: 'ust-10', groupe: 'Taux longs', libelle: 'Treasury 10 ans', unite: '%', decimales: 2, frequence: 'quotidienne', source: 'Réserve fédérale, via FRED', url: FRED_PAGE('DGS10'),
    definition: 'Taux auquel l’État américain emprunte à 10 ans.', pourquoi: 'Le taux long de référence mondial.',
    obtenir: async (r, k) => dernieres(await fred(r, 'DGS10', 2, k)) },

  { cle: 'brent', groupe: 'Matières premières', libelle: 'Brent (prix comptant)', unite: '$', decimales: 2, frequence: 'quotidienne', source: 'U.S. Energy Information Administration, via FRED', url: FRED_PAGE('DCOILBRENTEU'),
    definition: 'Prix au comptant du pétrole de la mer du Nord, en dollars par baril.', pourquoi: 'Il pèse directement sur l’inflation, surtout en Europe.',
    obtenir: async (r, k) => dernieres(await fred(r, 'DCOILBRENTEU', 2, k)) },
];

/** Récupération HTTP avec délai maximal et une seconde tentative. */
export const recupererHttp: Recuperer = async (url) => {
  let derniere: unknown;
  for (let essai = 0; essai < 2; essai++) {
    try {
      const rep = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'revision-marches/1.0 (application de revision)', Accept: '*/*' } });
      if (!rep.ok) throw new Error(`HTTP ${rep.status}`);
      return await rep.text();
    } catch (e) {
      derniere = e;
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  throw derniere instanceof Error ? derniere : new Error(String(derniere));
};

/** Exécute des tâches avec au plus « limite » en parallèle. */
async function enFile<T>(taches: (() => Promise<T>)[], limite: number): Promise<void> {
  let i = 0;
  const travailleur = async () => { while (i < taches.length) { const t = taches[i++]; await t(); } };
  await Promise.all(Array.from({ length: Math.min(limite, taches.length) }, travailleur));
}

/** Collecte toutes les séries ; garde la dernière valeur connue de celles qui échouent. */
export async function collecter(precedent: Marche | null, recuperer: Recuperer = recupererHttp, fredCle?: string, maintenant = new Date()): Promise<Marche> {
  const iso = maintenant.toISOString();
  const series: Record<string, Serie> = {};
  const partiels: Record<string, Partiel> = {};
  let erreurs = 0;
  const details_erreurs: Record<string, string> = {};
  // Les séries calculées (USD/JPY, écart OAT-Bund) passent après celles dont elles dépendent.
  const simples = DEFINITIONS.filter((d) => !['usdjpy', 'oat-bund'].includes(d.cle));
  const calculees = DEFINITIONS.filter((d) => ['usdjpy', 'oat-bund'].includes(d.cle));
  // Échéance globale : une fonction planifiée Netlify est arrêtée au bout de 30 secondes.
  const limite = Date.now() + 24_000;
  const traiter = async (d: Definition) => {
    const { obtenir, ...meta } = d;
    try {
      if (Date.now() > limite) throw new Error('délai de collecte dépassé');
      const v = await obtenir(recuperer, fredCle, partiels);
      if (!Number.isFinite(v.valeur)) throw new Error('valeur non numérique');
      const p: Partiel = { ...meta, ...v };
      partiels[d.cle] = p;
      series[d.cle] = { ...p, releve_le: iso, statut: 'ok' };
    } catch (e) {
      erreurs++;
      const ancien = precedent?.series[d.cle];
      const message = e instanceof Error ? e.message : String(e);
      details_erreurs[d.cle] = message;
      if (ancien) series[d.cle] = { ...ancien, statut: 'ancien', erreur: message };
    }
  };
  await enFile(simples.map((d) => () => traiter(d)), 10);
  for (const d of calculees) await traiter(d);
  // Ordre d'affichage fixe : celui des définitions, quel que soit l'ordre d'arrivée des réponses.
  const ordonnees = Object.fromEntries(DEFINITIONS.filter((d) => series[d.cle]).map((d) => [d.cle, series[d.cle]]));
  return { genere_le: iso, series: ordonnees, erreurs, details_erreurs };
}
