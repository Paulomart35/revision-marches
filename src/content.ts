// Charge le contenu du dépôt (content/) et y superpose les contenus importés sur l'appareil.
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FichierChapitre, Module, PackActu, type TChapitre, type TElement, type TModule, type TPackActu } from './schema';
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
// Packs actu du dépôt : leurs questions et quiz rejoignent le reste du contenu.
const fichiersActu = import.meta.glob('../content/actu/*.json', { eager: true, import: 'default' });
export const PACKS_DEPOT: TPackActu[] = Object.values(fichiersActu).map((b) => PackActu.parse(b)).sort((a, b) => b.mois.localeCompare(a.mois));

base.chapitres.sort((a, b) => a.module - b.module || a.ordre - b.ordre);

export const CHAPITRES = base.chapitres;
export const ELEMENTS_DEPOT = new Map<string, TElement>(base.elements.map((e) => [e.id, e]));
// Seul le pack le plus récent alimente les questions : celles des mois passés sont périmées.
for (const e of PACKS_DEPOT[0]?.elements ?? []) ELEMENTS_DEPOT.set(e.id, e);

export interface Contenu {
  tous: TElement[];
  parId: Map<string, TElement>;
  deType: <T extends TElement['type']>(type: T, chapitre?: string) => Extract<TElement, { type: T }>[];
  modifies: Set<string>;
}

/** Contenu du dépôt + contenus importés (qui remplacent ou complètent). */
export function useContenu(): Contenu {
  const overrides = useLiveQuery(() => db.overrides.toArray(), [], []);
  const packsImportes = useLiveQuery(() => db.packs.toArray(), [], []);
  return useMemo(() => {
    const parId = new Map(ELEMENTS_DEPOT);
    // Si un pack importé est au moins aussi récent que celui du dépôt, ses questions remplacent celles du dépôt.
    const recent = [...packsImportes].sort((a, b) => b.pack.mois.localeCompare(a.pack.mois))[0]?.pack;
    if (recent && recent.mois >= (PACKS_DEPOT[0]?.mois ?? '')) {
      for (const e of PACKS_DEPOT[0]?.elements ?? []) parId.delete(e.id);
      for (const e of recent.elements) parId.set(e.id, e);
    }
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
  }, [overrides, packsImportes]);
}

export function chapitreDe(id: string): TChapitre | undefined {
  return CHAPITRES.find((c) => c.id === id);
}

/** Packs actu : ceux du dépôt et ceux importés sur l'appareil (qui priment à mois égal), du plus récent au plus ancien. */
export function usePacks(): TPackActu[] {
  const importes = useLiveQuery(() => db.packs.toArray(), [], []);
  return useMemo(() => {
    const parMois = new Map(PACKS_DEPOT.map((p) => [p.mois, p]));
    for (const i of importes) parMois.set(i.pack.mois, i.pack);
    return [...parMois.values()].sort((a, b) => b.mois.localeCompare(a.mois));
  }, [importes]);
}
