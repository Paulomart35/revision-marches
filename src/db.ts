// Stockage local (IndexedDB) : tout ce qui est propre à l'appareil.
import Dexie, { type Table } from 'dexie';
import type { Card } from 'ts-fsrs';
import type { TElement, TPackActu } from './schema';

export interface EtatCarte { id: string; carte: Card; echeance: number }
export type Note = 'pas' | 'moitie' | 'savais';
export interface Reponse { id: string; type: 'question' | 'quiz' | 'exercice' | 'cas'; note: Note; date: number; n: number }
export interface EtatFiche { id: string; statut: 'vue' | 'comprise'; date: number }
export interface Marque { cle: string; id: string; liste: 'favori' | 'a_revoir'; date: number }
export interface Clarif {
  n?: number; elementId: string | null; manques: string[]; commentaire: string; phrase: string; date: number;
  statut: 'ouvert' | 'traite';
}
export interface Override { id: string; element: TElement; historique: { element: TElement | null; date: number }[]; date: number }
export interface Reglage { cle: string; valeur: unknown }
export interface PackImporte { id: string; pack: TPackActu; date: number }

class Base extends Dexie {
  cartes!: Table<EtatCarte, string>;
  reponses!: Table<Reponse, string>;
  fiches!: Table<EtatFiche, string>;
  marques!: Table<Marque, string>;
  clarifs!: Table<Clarif, number>;
  overrides!: Table<Override, string>;
  reglages!: Table<Reglage, string>;
  packs!: Table<PackImporte, string>;
  constructor() {
    super('revision-marches');
    this.version(1).stores({
      cartes: 'id, echeance',
      reponses: 'id, type, note',
      fiches: 'id, statut',
      marques: 'cle, id, liste',
      clarifs: '++n, elementId, statut',
      overrides: 'id',
      reglages: 'cle',
    });
    this.version(2).stores({ packs: 'id' });
  }
}
export const db = new Base();

const TABLES = ['cartes', 'reponses', 'fiches', 'marques', 'clarifs', 'overrides', 'reglages', 'packs'] as const;

/** Sauvegarde complète des données de l'appareil. */
export async function exporterTout(): Promise<string> {
  const donnees: Record<string, unknown[]> = {};
  for (const t of TABLES) donnees[t] = await db.table(t).toArray();
  return JSON.stringify({ app: 'revision-marches', format: 1, date: new Date().toISOString(), donnees }, null, 2);
}

export async function restaurerTout(json: string): Promise<void> {
  const s = JSON.parse(json);
  if (s?.app !== 'revision-marches' || !s.donnees) throw new Error("Ce fichier n'est pas une sauvegarde de l'app.");
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      const lignes = (s.donnees[t] ?? []) as { carte?: Card }[];
      for (const l of lignes) {
        // Les dates sont devenues des chaînes dans le JSON : on les reconstruit.
        if (l.carte) {
          l.carte.due = new Date(l.carte.due);
          if (l.carte.last_review) l.carte.last_review = new Date(l.carte.last_review);
        }
      }
      if (lignes.length) await db.table(t).bulkPut(lignes);
    }
  });
}

export const ecrireReglage = (cle: string, valeur: unknown) => db.reglages.put({ cle, valeur });

export async function basculerMarque(id: string, liste: Marque['liste']) {
  const cle = `${liste}:${id}`;
  if (await db.marques.get(cle)) await db.marques.delete(cle);
  else await db.marques.put({ cle, id, liste, date: Date.now() });
}

export async function noter(id: string, type: Reponse['type'], note: Note) {
  const avant = await db.reponses.get(id);
  await db.reponses.put({ id, type, note, date: Date.now(), n: (avant?.n ?? 0) + 1 });
}

export async function marquerFiche(id: string, statut: EtatFiche['statut']) {
  const avant = await db.fiches.get(id);
  if (statut === 'vue' && avant) return; // ne rétrograde pas une fiche comprise
  await db.fiches.put({ id, statut, date: Date.now() });
}
