// Petits utilitaires partagés : routeur, mini-Markdown, formats, fichiers.
import { Fragment, useEffect, useState, type ReactNode } from 'react';

/* ---------- Routeur par ancre (#/fiche/xxx?cle=valeur) ---------- */
export interface Route { chemin: string[]; params: URLSearchParams }

function lire(): Route {
  const brut = window.location.hash.replace(/^#\/?/, '');
  const [chemin, requete = ''] = brut.split('?');
  return { chemin: chemin.split('/').filter(Boolean).map(decodeURIComponent), params: new URLSearchParams(requete) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(lire);
  useEffect(() => {
    const maj = () => {
      setRoute(lire());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', maj);
    return () => window.removeEventListener('hashchange', maj);
  }, []);
  return route;
}

export const aller = (chemin: string) => {
  window.location.hash = chemin.startsWith('#') ? chemin : '#/' + chemin.replace(/^\//, '');
};

/* ---------- Mini-Markdown : **gras**, *italique*, listes « - », paragraphes, liens [[id|texte]] ---------- */
function enLigne(texte: string, cle: string): ReactNode[] {
  const morceaux = texte.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[\[[^\]]+\]\])/g);
  return morceaux.map((m, i) => {
    const k = `${cle}-${i}`;
    if (m.startsWith('**')) return <strong key={k}>{m.slice(2, -2)}</strong>;
    if (m.startsWith('[[')) {
      const [id, libelle] = m.slice(2, -2).split('|');
      return <a key={k} href={`#/element/${encodeURIComponent(id)}`}>{libelle ?? id}</a>;
    }
    if (m.startsWith('*') && m.length > 2) return <em key={k}>{m.slice(1, -1)}</em>;
    return <Fragment key={k}>{m}</Fragment>;
  });
}

export function Md({ children }: { children: string }) {
  const blocs = children.split(/\n{2,}/);
  return (
    <>
      {blocs.map((bloc, i) => {
        const lignes = bloc.split('\n');
        const puces = lignes.filter((l) => l.startsWith('- '));
        if (puces.length === lignes.length) {
          return <ul key={i}>{puces.map((l, j) => <li key={j}>{enLigne(l.slice(2), `${i}-${j}`)}</li>)}</ul>;
        }
        const avant = lignes.filter((l) => !l.startsWith('- '));
        return (
          <Fragment key={i}>
            <p>{enLigne(avant.join(' '), `${i}`)}</p>
            {puces.length > 0 && <ul>{puces.map((l, j) => <li key={j}>{enLigne(l.slice(2), `${i}-${j}`)}</li>)}</ul>}
          </Fragment>
        );
      })}
    </>
  );
}

/* ---------- Formats français ---------- */
export const nf = (n: number, dec = 0) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const eur = (n: number) => nf(Math.round(n)) + ' €';
export const dateFr = (iso: string | number) =>
  new Date(typeof iso === 'string' && iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/** Lit un nombre saisi à la française (« 1 234,5 »). */
export function lireNombre(s: string): number {
  return Number(s.replace(/[\s  ]/g, '').replace(',', '.').replace(/[€$%]/g, ''));
}

/** Recherche insensible aux accents et à la casse. */
export const normaliser = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* ---------- Fichiers et presse-papiers ---------- */
export function telecharger(nom: string, contenu: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copier(texte: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    // Solution de repli pour les navigateurs qui refusent l'accès au presse-papiers.
    const zone = document.createElement('textarea');
    zone.value = texte;
    document.body.appendChild(zone);
    zone.select();
    const ok = document.execCommand('copy');
    zone.remove();
    return ok;
  }
}

export function lireFichier(accepter: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accepter;
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return reject(new Error('Aucun fichier choisi.'));
      f.text().then(resolve, reject);
    };
    input.click();
  });
}

export const melanger = <T,>(t: T[]): T[] => {
  const r = [...t];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

export const DIFFICULTES = ['', 'Facile', 'Moyen', 'Difficile'];
export const Points = ({ n }: { n: number }) => (
  <span className="points" title={DIFFICULTES[n]} aria-label={`Difficulté : ${DIFFICULTES[n]}`}>
    {'●'.repeat(n)}{'○'.repeat(3 - n)}
  </span>
);
