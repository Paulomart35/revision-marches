// GET /api/marche : renvoie les derniers chiffres collectés (stockés dans Netlify Blobs).
import { getStore } from '@netlify/blobs';
import type { Config } from '@netlify/functions';
import type { Marche } from '../lib/collecte';

export default async () => {
  const marche = (await getStore('marche').get('dernier', { type: 'json' })) as Marche | null;
  if (!marche) {
    return Response.json({ message: 'Pas encore de données : la collecte a lieu chaque jour à 17 h UTC.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  return Response.json(marche, { headers: { 'Cache-Control': 'public, max-age=300' } });
};

export const config: Config = { path: '/api/marche' };
