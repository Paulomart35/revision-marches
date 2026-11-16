// Charge le contenu du dépôt (content/) et y superpose les contenus importés sur l'appareil.
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FichierChapitre, Module, type TChapitre, type TElement, type TModule } from './schema';
import { db } from './db';
import modulesJson from '../content/modules.json';

const fichiers = import.meta.glob('../content/module-*/*.json', { eager: true, import: 'default' });

export const MODULES: TModule[] = (modulesJson as unknown[]).map((m) => Module.parse(m));

const base: { chapitres: TChapitre[]; elements: TElement[] } = { chapitres: [], elements: [] };
for (const brut of Object.values(fichiers)) {
  const f = FichierChapitre.parse(brut);
  base.chapitres.push(f.chapitre);
  base.elements.push(...f.elements);
}
base.chapitres.sort((a, b) => a.module - b.module || a.ordre - b.ordre);

export const CHAPITRES = base.chapitres;
export const ELEMENTS_DEPOT = new Map(base.elements.map((e) => [e.id, e]));

export interface Contenu {
  tous: TElement[];
  parId: Map<string, TElement>;
  deType: <T extends TElement['type']>(type: T, chapitre?: string) => Extract<TElement, { type: T }>[];
  modifies: Set<string>;
}

/** Contenu du dépôt + contenus importés (qui remplacent ou complètent). */
export function useContenu(): Contenu {
  const overrides = useLiveQuery(() => db.overrides.toArray(), [], []);
  return useMemo(() => {
    const parId = new Map(ELEMENTS_DEPOT);
    const modifies = new Set<string>();
    for (const o of overrides) {
      parId.set(o.id, o.element);
      modifies.add(o.id);
    }
    const tous = [...parId.values()];
    return {
      tous,
      parId,
      modifies,
      deType: (type, chapitre) =>
        tous.filter((e) => e.type === type && (!chapitre || e.chapitre === chapitre)) as never,
    };
  }, [overrides]);
}

export function chapitreDe(id: string): TChapitre | undefined {
  return CHAPITRES.find((c) => c.id === id);
}
