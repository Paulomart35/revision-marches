// Chiffres de marché mis à jour automatiquement (fonction Netlify), avec une copie locale pour le hors-ligne.
import { useEffect, useState } from 'react';
import { db } from './db';
import { dateFr, nf } from './lib';
import type { Marche, Serie } from '../netlify/lib/collecte';

export type { Marche, Serie };
export type EtatMarche = 'chargement' | 'a-jour' | 'copie' | 'indisponible';

const CLE = 'marche-auto';

export function useMarcheAuto(): { marche: Marche | null; etat: EtatMarche } {
  const [marche, setMarche] = useState<Marche | null>(null);
  const [etat, setEtat] = useState<EtatMarche>('chargement');
  useEffect(() => {
    let fini = false;
    (async () => {
      const copie = (await db.reglages.get(CLE).catch(() => undefined))?.valeur as Marche | undefined;
      if (copie && !fini) { setMarche(copie); setEtat('copie'); }
      try {
        const rep = await fetch('/api/marche', { signal: AbortSignal.timeout(8000) });
        if (!rep.ok) throw new Error(`HTTP ${rep.status}`);
        const frais = (await rep.json()) as Marche;
        if (!frais.series) throw new Error('réponse inattendue');
        if (fini) return;
        setMarche(frais); setEtat('a-jour');
        await db.reglages.put({ cle: CLE, valeur: frais });
      } catch {
        if (!fini) setEtat(copie ? 'copie' : 'indisponible');
      }
    })();
    return () => { fini = true; };
  }, []);
  return { marche, etat };
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
/** Date d'une valeur : « 17 novembre 2026 » ou « octobre 2026 » pour une donnée mensuelle. */
export const dateValeur = (d: string) => (d.length === 7 ? `${MOIS[Number(d.slice(5)) - 1]} ${d.slice(0, 4)}` : dateFr(d));

export function valeurTexte(s: Pick<Serie, 'valeur' | 'unite' | 'decimales' | 'texte'>, v = s.valeur): string {
  if (s.texte && v === s.valeur) return s.texte;
  const n = nf(v, s.decimales);
  return s.unite === '%' ? `${n} %` : s.unite === 'pb' ? `${n} pb` : s.unite === '$' ? `${n} $` : n;
}

/** Variation depuis l'observation précédente, dans l'unité de la série (points de % → points de base pour les taux). */
export function variation(s: Serie): { sens: 'hausse' | 'baisse' | 'stable'; texte: string } | null {
  if (!s.precedent) return null;
  const d = s.valeur - s.precedent.valeur;
  const seuil = Math.pow(10, -s.decimales) / 2;
  const sens = Math.abs(d) < seuil ? 'stable' : d > 0 ? 'hausse' : 'baisse';
  let ecart: string;
  if (s.unite === '%' && s.groupe !== 'Inflation') ecart = `${d > 0 ? '+' : d < 0 ? '−' : ''}${nf(Math.abs(d) * 100, 0)} pb`;
  else if (s.unite === '%') ecart = `${d > 0 ? '+' : d < 0 ? '−' : ''}${nf(Math.abs(d), s.decimales)} pt`;
  else if (s.unite === 'pb') ecart = `${d > 0 ? '+' : d < 0 ? '−' : ''}${nf(Math.abs(d), 0)} pb`;
  else ecart = `${d > 0 ? '+' : d < 0 ? '−' : ''}${nf((Math.abs(d) / s.precedent.valeur) * 100, 2)} %`;
  return { sens, texte: `${ecart} depuis ${dateValeur(s.precedent.date)}` };
}
