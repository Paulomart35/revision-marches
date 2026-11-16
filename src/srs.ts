// Répétition espacée (FSRS). Quatre boutons : à revoir, difficile, bien, facile.
import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from 'ts-fsrs';
import { db, type EtatCarte } from './db';

const moteur = fsrs({ enable_fuzz: false });

export const BOUTONS: { note: Grade; libelle: string; classe: string }[] = [
  { note: Rating.Again, libelle: 'À revoir', classe: 'ko' },
  { note: Rating.Hard, libelle: 'Difficile', classe: 'dur' },
  { note: Rating.Good, libelle: 'Bien', classe: 'ok' },
  { note: Rating.Easy, libelle: 'Facile', classe: 'facile' },
];

/** Calcule le nouvel état d'une carte après une évaluation (fonction pure, testée). */
export function evaluer(carte: Card | undefined, note: Grade, maintenant: Date): Card {
  return moteur.next(carte ?? createEmptyCard(maintenant), maintenant, note).card;
}

/** Délai avant la prochaine révision, en texte, pour chaque bouton. */
export function delais(carte: Card | undefined, maintenant: Date): Record<number, string> {
  const res: Record<number, string> = {};
  for (const b of BOUTONS) {
    const c = evaluer(carte, b.note, maintenant);
    res[b.note] = duree(c.due.getTime() - maintenant.getTime());
  }
  return res;
}

export function duree(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const j = Math.round(h / 24);
  if (j < 31) return `${j} j`;
  const mois = Math.round(j / 30);
  return mois < 12 ? `${mois} mois` : `${(j / 365).toFixed(1).replace('.', ',')} an(s)`;
}

export async function enregistrer(id: string, note: Grade): Promise<void> {
  const avant = await db.cartes.get(id);
  const carte = evaluer(avant?.carte, note, new Date());
  await db.cartes.put({ id, carte, echeance: carte.due.getTime() });
}

/** Une carte est « maîtrisée » quand elle est en révision avec un intervalle d'au moins 7 jours. */
export function maitrisee(e: EtatCarte | undefined): boolean {
  return !!e && e.carte.state === State.Review && e.carte.scheduled_days >= 7;
}

/** Ordre de passage : d'abord les cartes en retard (les plus anciennes en premier), puis les nouvelles. */
export function file(ids: string[], etats: Map<string, EtatCarte>, maintenant: number, avecNouvelles = true): string[] {
  const dues = ids
    .filter((i) => etats.has(i) && etats.get(i)!.echeance <= maintenant)
    .sort((a, b) => etats.get(a)!.echeance - etats.get(b)!.echeance);
  const nouvelles = avecNouvelles ? ids.filter((i) => !etats.has(i)) : [];
  return [...dues, ...nouvelles];
}
