// Fonction planifiée : une collecte par jour, à 17 h UTC (après la publication des taux de change de référence
// de la BCE, vers 16 h heure de Paris). Une seule exécution quotidienne pour limiter la consommation de crédits Netlify.
import { getStore } from '@netlify/blobs';
import type { Config } from '@netlify/functions';
import { collecter, type Marche } from '../lib/collecte';

export default async () => {
  const store = getStore('marche');
  const precedent = (await store.get('dernier', { type: 'json' })) as Marche | null;
  const marche = await collecter(precedent, undefined, process.env.FRED_API_KEY);
  await store.setJSON('dernier', marche);
  console.log(`Collecte terminée : ${Object.keys(marche.series).length} séries, ${marche.erreurs} erreur(s).`, marche.details_erreurs ?? {});
};

export const config: Config = { schedule: '0 17 * * *' };
