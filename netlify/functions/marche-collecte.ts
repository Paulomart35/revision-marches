// Fonction planifiée : appelée toutes les heures, elle ne collecte que si les données ont plus de 12 heures
// (ou n'existent pas encore). Résultat : deux mises à jour par jour, et des données disponibles moins d'une heure
// après le premier déploiement.
import { getStore } from '@netlify/blobs';
import type { Config } from '@netlify/functions';
import { collecter, type Marche } from '../lib/collecte';

const AGE_MAX_MS = 12 * 3600 * 1000;

export default async () => {
  const store = getStore('marche');
  const precedent = (await store.get('dernier', { type: 'json' })) as Marche | null;
  if (precedent && Date.now() - new Date(precedent.genere_le).getTime() < AGE_MAX_MS) {
    console.log(`Données récentes (${precedent.genere_le}) : rien à faire.`);
    return;
  }
  const marche = await collecter(precedent, undefined, process.env.FRED_API_KEY);
  await store.setJSON('dernier', marche);
  console.log(`Collecte terminée : ${Object.keys(marche.series).length} séries, ${marche.erreurs} erreur(s).`, marche.details_erreurs ?? {});
};

export const config: Config = { schedule: '@hourly' };
