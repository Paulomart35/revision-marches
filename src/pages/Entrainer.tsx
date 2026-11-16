// S'entraîner : file d'éléments (cartes, questions, quiz, exercices, cas) et modes de session.
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type EtatCarte, type Reponse } from '../db';
import { CHAPITRES, type Contenu } from '../content';
import { Rendu } from '../components/Elements';
import { duree, file } from '../srs';
import { DIFFICULTES, aller, type Route } from '../lib';
import { titreDe, type TElement } from '../schema';

type Genre = 'cartes' | 'questions' | 'quiz' | 'exercices' | 'cas';
const TYPE: Record<Genre, TElement['type']> = { cartes: 'carte', questions: 'question_entretien', quiz: 'quiz', exercices: 'exercice', cas: 'cas_pratique' };
const NOM: Record<Genre, string> = { cartes: 'Cartes de révision', questions: 'Questions d\'entretien', quiz: 'Quiz', exercices: 'Exercices chiffrés', cas: 'Cas pratiques client' };

/** Les éléments ratés reviennent en premier, puis les jamais vus, puis les réussis (les plus anciens d'abord). */
export function prioriser(ids: string[], reponses: Map<string, Reponse>): string[] {
  const rang = (id: string) => {
    const r = reponses.get(id);
    return !r ? 2 : r.note === 'pas' ? 0 : r.note === 'moitie' ? 1 : 3;
  };
  return [...ids].sort((a, b) => rang(a) - rang(b) || (reponses.get(a)?.date ?? 0) - (reponses.get(b)?.date ?? 0));
}

async function etats() {
  const [c, r, f] = await Promise.all([db.cartes.toArray(), db.reponses.toArray(), db.fiches.toArray()]);
  return {
    cartes: new Map<string, EtatCarte>(c.map((x) => [x.id, x])),
    reponses: new Map<string, Reponse>(r.map((x) => [x.id, x])),
    fiches: new Map(f.map((x) => [x.id, x])),
  };
}

/* ---------- La file : un élément à la fois ---------- */
export function File({ ids, contenu, titre, vide }: { ids: string[]; contenu: Contenu; titre: string; vide?: React.ReactNode }) {
  const [i, setI] = useState(0);
  useEffect(() => { setI(0); }, [ids]);
  useEffect(() => { window.scrollTo(0, 0); }, [i]);
  if (ids.length === 0) return <div className="page"><h1>{titre}</h1>{vide ?? <p>Rien à faire ici pour l'instant.</p>}</div>;
  if (i >= ids.length)
    return (
      <div className="page fin">
        <h1>Terminé</h1>
        <p>{ids.length} élément{ids.length > 1 ? 's' : ''} vu{ids.length > 1 ? 's' : ''}. Tu peux t'arrêter là ou continuer, comme tu veux.</p>
        <div className="ligne"><a className="btn y" href="#/">Accueil</a><a className="btn g" href="#/entrainer">S'entraîner encore</a></div>
      </div>
    );
  const e = contenu.parId.get(ids[i]);
  return (
    <div className="page">
      <div className="progression"><span>{titre}</span><span>{i + 1} / {ids.length}</span></div>
      <div className="jauge"><i style={{ width: `${(i / ids.length) * 100}%` }} /></div>
      {e ? <Rendu e={e} contenu={contenu} onSuite={() => setI(i + 1)} /> : <p>Élément introuvable.</p>}
      <button className="passer" onClick={() => setI(i + 1)}>Passer</button>
    </div>
  );
}

/* ---------- Filtres : chapitre, difficulté, points faibles ---------- */
function Filtres({ route, genre }: { route: Route; genre: Genre }) {
  const p = route.params;
  const maj = (cle: string, valeur: string) => {
    const n = new URLSearchParams(p);
    if (valeur) n.set(cle, valeur); else n.delete(cle);
    n.delete('go');
    aller(`${genre}?${n}`);
  };
  return (
    <div className="filtres">
      <label>Chapitre
        <select value={p.get('ch') ?? ''} onChange={(e) => maj('ch', e.target.value)}>
          <option value="">Tous</option>
          {CHAPITRES.map((c) => <option key={c.id} value={c.id}>{c.module}.{c.ordre} {c.titre}</option>)}
        </select>
      </label>
      <label>Difficulté
        <select value={p.get('diff') ?? ''} onChange={(e) => maj('diff', e.target.value)}>
          <option value="">Toutes</option>
          {[1, 2, 3].map((d) => <option key={d} value={d}>{DIFFICULTES[d]}</option>)}
        </select>
      </label>
      {genre !== 'cartes' && (
        <label className="case"><input type="checkbox" checked={p.get('faibles') === '1'} onChange={(e) => maj('faibles', e.target.checked ? '1' : '')} /> Mes points faibles</label>
      )}
    </div>
  );
}

/* ---------- Une page par genre : filtres, puis la file ---------- */
export function PageGenre({ genre, route, contenu }: { genre: Genre; route: Route; contenu: Contenu }) {
  const p = route.params;
  const cle = p.toString();
  const [ids, setIds] = useState<string[] | null>(null);
  const [info, setInfo] = useState<{ total: number; dues: number; prochaine?: number }>({ total: 0, dues: 0 });
  const lance = p.get('go') === '1' || !!p.get('fiche');

  useEffect(() => {
    let annule = false;
    (async () => {
      const { cartes, reponses } = await etats();
      let els = contenu.tous.filter((e) => e.type === TYPE[genre]);
      if (p.get('ch')) els = els.filter((e) => e.chapitre === p.get('ch'));
      if (p.get('diff')) els = els.filter((e) => e.difficulte === Number(p.get('diff')));
      if (p.get('fiche')) els = els.filter((e) => 'fiche' in e && e.fiche === p.get('fiche'));
      if (p.get('faibles') === '1') els = els.filter((e) => ['pas', 'moitie'].includes(reponses.get(e.id)?.note ?? ''));
      const tous = els.map((e) => e.id);
      let liste: string[];
      if (genre === 'cartes') {
        const maintenant = Date.now();
        liste = p.get('tout') === '1' ? tous : file(tous, cartes, maintenant);
        const futures = tous.map((i) => cartes.get(i)?.echeance ?? 0).filter((t) => t > maintenant);
        if (!annule) setInfo({ total: tous.length, dues: liste.length, prochaine: futures.length ? Math.min(...futures) - maintenant : undefined });
      } else {
        liste = prioriser(tous, reponses);
        if (!annule) setInfo({ total: tous.length, dues: tous.length });
      }
      if (!annule) setIds(liste);
    })();
    return () => { annule = true; };
    // La file est figée au lancement : elle ne se réordonne pas pendant qu'on répond.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genre, cle, contenu.tous.length]);

  if (!ids) return <div className="page"><h1>{NOM[genre]}</h1></div>;
  if (lance)
    return (
      <File ids={ids} contenu={contenu} titre={NOM[genre]}
        vide={genre === 'cartes'
          ? <><p>Aucune carte à réviser maintenant. {info.prochaine !== undefined && <>La prochaine revient dans {duree(info.prochaine)}.</>}</p><a className="btn g" href={`#/cartes?${cle}&tout=1`}>Réviser quand même ces {info.total} cartes</a></>
          : <p>Aucun élément ne correspond à ces filtres.</p>} />
    );
  const liste = contenu.tous.filter((e) => ids.includes(e.id));
  return (
    <div className="page">
      <h1>{NOM[genre]}</h1>
      <Filtres route={route} genre={genre} />
      <p className="note">
        {genre === 'cartes'
          ? `${info.dues} carte(s) à voir maintenant sur ${info.total} (en retard d'abord, puis nouvelles).`
          : `${info.total} élément(s). Ceux que tu as ratés passent en premier.`}
      </p>
      <a className={`btn y large${ids.length ? '' : ' off'}`} href={`#/${genre}?${cle}${cle ? '&' : ''}go=1`}>Commencer</a>
      {genre === 'cartes' && ids.length === 0 && info.total > 0 && <a className="btn g large" href={`#/cartes?${cle}${cle ? '&' : ''}go=1&tout=1`}>Réviser quand même</a>}
      {(genre === 'exercices' || genre === 'cas' || genre === 'questions') && (
        <ul className="liste">{ids.map((id) => { const e = liste.find((x) => x.id === id); return e ? <li key={id}><a href={`#/element/${id}`}>{titreDe(e)}</a></li> : null; })}</ul>
      )}
    </div>
  );
}

/* ---------- Le carrefour « S'entraîner » ---------- */
export function Entrainer({ contenu }: { contenu: Contenu }) {
  const dues = useLiveQuery(async () => {
    const { cartes } = await etats();
    return file(contenu.deType('carte').map((c) => c.id), cartes, Date.now(), false).length;
  }, [contenu.tous.length], 0);
  const n = (g: Genre) => contenu.tous.filter((e) => e.type === TYPE[g]).length;
  return (
    <div className="page">
      <h1>S'entraîner</h1>
      <div className="grille">
        <a className="tuile" href="#/questions"><b>Questions d'entretien</b><span>{n('questions')} questions avec solution rédigée</span></a>
        <a className="tuile" href="#/cartes"><b>Cartes de révision</b><span>{n('cartes')} cartes · {dues} en retard</span></a>
        <a className="tuile" href="#/quiz"><b>Quiz</b><span>{n('quiz')} questions : QCM, vrai/faux, calcul, ordre</span></a>
        <a className="tuile" href="#/exercices"><b>Exercices chiffrés</b><span>{n('exercices')} exercices corrigés pas à pas</span></a>
        <a className="tuile" href="#/cas"><b>Cas pratiques client</b><span>{n('cas')} mises en situation</span></a>
      </div>
      <h2>Révision ciblée</h2>
      <ul className="liste">
        {CHAPITRES.map((c) => (
          <li key={c.id}>
            <b>{c.module}.{c.ordre} {c.titre}</b>
            <span className="liens"><a href={`#/cartes?ch=${c.id}&go=1`}>Cartes</a><a href={`#/questions?ch=${c.id}&go=1`}>Questions</a><a href={`#/quiz?ch=${c.id}&go=1`}>Quiz</a></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Modes de session : « J'ai 2 minutes », « J'ai 10 minutes » ---------- */
export function Session({ minutes, contenu }: { minutes: number; contenu: Contenu }) {
  const [ids, setIds] = useState<string[] | null>(null);
  useEffect(() => {
    (async () => {
      const { cartes, reponses, fiches } = await etats();
      const idsCartes = contenu.deType('carte').map((c) => c.id);
      const maintenant = Date.now();
      const enRetard = file(idsCartes, cartes, maintenant, false);
      const nouvelles = idsCartes.filter((i) => !cartes.has(i));
      const questions = prioriser(contenu.deType('question_entretien').map((q) => q.id), reponses);
      if (minutes === 2) {
        // 5 cartes (en retard d'abord, complétées par des nouvelles) ; s'il n'y a plus de carte, 3 questions.
        const c = [...enRetard, ...nouvelles].slice(0, 5);
        setIds(c.length ? c : questions.slice(0, 3));
      } else {
        const c = [...enRetard.slice(0, 10), ...nouvelles].slice(0, 10);
        const ficheNouvelle = contenu.deType('fiche').find((f) => !fiches.has(f.id));
        setIds([...c.slice(0, 5), ...(ficheNouvelle ? [ficheNouvelle.id] : []), ...c.slice(5), ...questions.slice(0, 3)]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minutes]);
  if (!ids) return <div className="page" />;
  return <File ids={ids} contenu={contenu} titre={`J'ai ${minutes} minutes`} />;
}
