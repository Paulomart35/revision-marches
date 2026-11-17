import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import MiniSearch from 'minisearch';
import { CHAPITRES, MODULES, chapitreDe, useContenu, usePacks, type Contenu } from './content';
import { db, ecrireReglage, exporterTout, restaurerTout } from './db';
import { maitrisee } from './srs';
import { Rendu } from './components/Elements';
import { Entrainer, PageGenre, Session } from './pages/Entrainer';
import { Clarifier } from './pages/Clarifier';
import { Marche } from './pages/Marche';
import { OUTILS } from './tools';
import { Points, dateFr, lireFichier, normaliser, telecharger, useRoute } from './lib';
import { NOMS_TYPES, titreDe, type TElement } from './schema';

/* ---------- Progression : fiches comprises, cartes maîtrisées, questions sues ---------- */
function useProgression(contenu: Contenu) {
  const fiches = useLiveQuery(() => db.fiches.toArray(), [], []);
  const cartes = useLiveQuery(() => db.cartes.toArray(), [], []);
  const reponses = useLiveQuery(() => db.reponses.toArray(), [], []);
  return useMemo(() => {
    const f = new Map(fiches.map((x) => [x.id, x]));
    const c = new Map(cartes.map((x) => [x.id, x]));
    const r = new Map(reponses.map((x) => [x.id, x]));
    const acquis = (e: TElement) =>
      e.type === 'fiche' ? f.get(e.id)?.statut === 'comprise'
        : e.type === 'carte' ? maitrisee(c.get(e.id))
          : e.type === 'question_entretien' ? r.get(e.id)?.note === 'savais' : null;
    const pct = (filtre: (e: TElement) => boolean) => {
      const parType: Record<string, [number, number]> = {};
      for (const e of contenu.tous.filter(filtre)) {
        const a = acquis(e);
        if (a === null) continue;
        const t = (parType[e.type] ??= [0, 0]);
        t[1]++;
        if (a) t[0]++;
      }
      const parts = Object.values(parType).filter(([, n]) => n > 0).map(([k, n]) => k / n);
      return parts.length ? Math.round((parts.reduce((s, x) => s + x, 0) / parts.length) * 100) : 0;
    };
    const faibles = contenu.tous.filter((e) => ['pas', 'moitie'].includes(r.get(e.id)?.note ?? ''));
    const maintenant = Date.now();
    const enRetard = contenu.tous.filter((e) => e.type === 'carte' && c.has(e.id) && c.get(e.id)!.echeance <= maintenant).length;
    return { pct, faibles, enRetard, fiches: f };
  }, [contenu, fiches, cartes, reponses]);
}

function Jauge({ pct }: { pct: number }) {
  return <span className="jauge-ligne"><span className="jauge"><i style={{ width: `${pct}%` }} /></span><span className="n">{pct} %</span></span>;
}

/* ---------- Accueil ---------- */
function Accueil({ contenu }: { contenu: Contenu }) {
  const prog = useProgression(contenu);
  const nbClarifs = useLiveQuery(() => db.clarifs.where('statut').equals('ouvert').count(), [], 0);
  const fiches = contenu.deType('fiche');
  const reprendre = fiches.find((f) => prog.fiches.get(f.id)?.statut !== 'comprise');
  const pack = usePacks()[0];
  const cles = ['bce-depot', 'inflation-ze', 'eurusd'].map((k) => pack?.chiffres.find((c) => c.cle === k)).filter((c) => !!c);
  return (
    <div className="page accueil">
      <div className="sessions">
        <a className="tuile forte" href="#/session/2"><b>J'ai 2 minutes</b><span>5 cartes ou 3 questions</span></a>
        <a className="tuile forte" href="#/session/10"><b>J'ai 10 minutes</b><span>Cartes, une fiche, des questions</span></a>
      </div>
      <a className="btn g large" href="#/entrainer">Révision ciblée</a>

      {reprendre && (
        <>
          <h2>{prog.fiches.size ? 'Reprendre' : 'Commencer'}</h2>
          <a className="tuile" href={`#/fiche/${reprendre.id}`}><b>{reprendre.titre}</b><span>{chapitreDe(reprendre.chapitre)?.titre}</span></a>
        </>
      )}

      {pack && cles.length > 0 && (
        <>
          <h2>Le marché · {dateFr(pack.arrete_le)}</h2>
          <a className="marche-bref" href="#/marche">
            {cles.map((c) => <span key={c.cle}><small>{c.libelle}</small><b>{c.valeur}</b></span>)}
          </a>
        </>
      )}

      <h2>Où j'en suis</h2>
      <div className="stats">
        <a href="#/cartes?go=1"><b>{prog.enRetard}</b><span>carte(s) en retard</span></a>
        <a href="#/questions?faibles=1"><b>{prog.faibles.length}</b><span>point(s) faible(s)</span></a>
        <a href="#/clarifier"><b>{nbClarifs}</b><span>à clarifier</span></a>
      </div>

      <h2>Modules</h2>
      <ul className="liste modules">
        {MODULES.map((m) => (
          <li key={m.id} className={m.disponible ? '' : 'bientot'}>
            {m.disponible
              ? <a href={`#/apprendre`}><b>{m.id}. {m.court}</b><Jauge pct={prog.pct((e) => e.module === m.id)} /></a>
              : <span><b>{m.id}. {m.court}</b><small>à venir</small></span>}
          </li>
        ))}
      </ul>
      <p className="note">Pas d'objectif quotidien, pas de série à tenir : tu ouvres quand tu veux, la progression t'attend.</p>
    </div>
  );
}

/* ---------- Apprendre : modules → chapitres → fiches ---------- */
function Apprendre({ contenu }: { contenu: Contenu }) {
  const prog = useProgression(contenu);
  return (
    <div className="page">
      <h1>Apprendre</h1>
      {MODULES.map((m) => {
        const chapitres = CHAPITRES.filter((c) => c.module === m.id);
        return (
          <section key={m.id}>
            <h2>{m.id}. {m.titre}</h2>
            {chapitres.length === 0 && <p className="note">À venir.</p>}
            <ul className="liste">
              {chapitres.map((c) => (
                <li key={c.id}><a href={`#/chapitre/${c.id}`}><b>{c.module}.{c.ordre} {c.titre}</b><Jauge pct={prog.pct((e) => e.chapitre === c.id)} /></a></li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Chapitre({ id, contenu }: { id: string; contenu: Contenu }) {
  const prog = useProgression(contenu);
  const c = chapitreDe(id);
  if (!c) return <div className="page"><p>Chapitre introuvable.</p></div>;
  const n = (t: TElement['type']) => contenu.deType(t, id).length;
  return (
    <div className="page">
      <a className="retour" href="#/apprendre">‹ Apprendre</a>
      <h1>{c.titre}</h1>
      <p>{c.resume}</p>
      <ul className="liste fiches">
        {contenu.deType('fiche', id).map((f, i) => {
          const s = prog.fiches.get(f.id)?.statut;
          return <li key={f.id}><a href={`#/fiche/${f.id}`}><span className={`etat ${s ?? ''}`}>{s === 'comprise' ? '✓' : i + 1}</span><b>{f.titre}</b><Points n={f.difficulte} /></a></li>;
        })}
      </ul>
      <h2>S'entraîner sur ce chapitre</h2>
      <div className="liens">
        <a href={`#/cartes?ch=${id}&go=1`}>{n('carte')} cartes</a>
        <a href={`#/questions?ch=${id}`}>{n('question_entretien')} questions d'entretien</a>
        <a href={`#/quiz?ch=${id}&go=1`}>{n('quiz')} quiz</a>
        <a href={`#/exercices?ch=${id}`}>{n('exercice')} exercices</a>
        {n('cas_pratique') > 0 && <a href={`#/cas?ch=${id}`}>{n('cas_pratique')} cas pratique(s)</a>}
      </div>
    </div>
  );
}

function PageElement({ id, contenu }: { id: string; contenu: Contenu }) {
  const e = contenu.parId.get(id);
  if (!e) return <div className="page"><p>Élément « {id} » introuvable.</p><a className="btn g" href="#/">Accueil</a></div>;
  const fiches = e.type === 'fiche' ? contenu.deType('fiche', e.chapitre) : [];
  const i = fiches.findIndex((f) => f.id === id);
  return (
    <div className="page">
      <a className="retour" href={`#/chapitre/${e.chapitre}`}>‹ {chapitreDe(e.chapitre)?.titre ?? 'Retour'}</a>
      <Rendu e={e} contenu={contenu} />
      {e.type === 'fiche' && (
        <nav className="precsuiv">
          {i > 0 ? <a href={`#/fiche/${fiches[i - 1].id}`}>‹ {fiches[i - 1].titre}</a> : <span />}
          {i < fiches.length - 1 ? <a href={`#/fiche/${fiches[i + 1].id}`}>{fiches[i + 1].titre} ›</a> : <a href={`#/quiz?ch=${e.chapitre}&go=1`}>Quiz du chapitre ›</a>}
        </nav>
      )}
    </div>
  );
}

/* ---------- Labo ---------- */
function Labo({ refOutil }: { refOutil?: string }) {
  const o = refOutil ? OUTILS[refOutil] : undefined;
  if (o)
    return (
      <div className="page">
        <a className="retour" href="#/labo">‹ Labo</a>
        <h1>{o.titre}</h1>
        {o.rendu()}
        <a className="lienfiche" href={`#/fiche/${o.fiche}`}>→ Voir la fiche qui l'explique</a>
      </div>
    );
  return (
    <div className="page">
      <h1>Labo</h1>
      <p className="note">Les outils à manipuler, regroupés. Chacun est aussi dans la fiche qu'il illustre.</p>
      <div className="grille">
        {Object.entries(OUTILS).map(([ref, x]) => <a key={ref} className="tuile" href={`#/labo/${ref}`}><b>{x.titre}</b><span>{x.resume}</span></a>)}
      </div>
      <p className="note">À venir avec le module 2 : explorateur d'option, grecques, couverture en delta, arbre binomial, Monte Carlo.</p>
    </div>
  );
}

/* ---------- Recherche globale et lexique ---------- */
function texteDe(e: TElement): string {
  return Object.values(e).filter((v) => typeof v === 'string').join(' ');
}

function Recherche({ contenu, lexiqueSeul }: { contenu: Contenu; lexiqueSeul?: boolean }) {
  const [q, setQ] = useState('');
  const index = useMemo(() => {
    const ms = new MiniSearch<{ id: string; titre: string; texte: string }>({
      fields: ['titre', 'texte'],
      processTerm: (t) => normaliser(t),
      searchOptions: { prefix: true, fuzzy: 0.15, boost: { titre: 3 } },
    });
    ms.addAll(contenu.tous.filter((e) => !lexiqueSeul || e.type === 'lexique').map((e) => ({ id: e.id, titre: titreDe(e) + (e.type === 'lexique' && e.anglais ? ' ' + e.anglais : ''), texte: texteDe(e) })));
    return ms;
  }, [contenu.tous, lexiqueSeul]);
  const lexique = useMemo(() => contenu.deType('lexique').sort((a, b) => a.terme.localeCompare(b.terme, 'fr')), [contenu]);
  const resultats = q.trim() ? index.search(q).slice(0, 40).map((r) => contenu.parId.get(r.id)!).filter(Boolean) : [];
  const ordre: TElement['type'][] = ['fiche', 'lexique', 'question_entretien', 'exercice', 'cas_pratique', 'carte', 'quiz'];
  return (
    <div className="page">
      <h1>{lexiqueSeul ? 'Lexique' : 'Recherche'}</h1>
      <input className="recherche" type="search" autoFocus={!lexiqueSeul} value={q} onChange={(e) => setQ(e.target.value)} placeholder={lexiqueSeul ? 'Chercher un terme…' : 'Fiches, lexique, questions…'} aria-label="Rechercher" />
      {!lexiqueSeul && !q.trim() && <p className="note">Tape un mot : « pip », « stagflation », « exportateur »… <a href="#/lexique">Ou parcours le lexique.</a></p>}
      {q.trim() && resultats.length === 0 && <p>Aucun résultat pour « {q} ».</p>}
      {q.trim() ? (
        ordre.map((t) => {
          const r = resultats.filter((e) => e.type === t);
          if (!r.length) return null;
          return (
            <section key={t}>
              {!lexiqueSeul && <h2>{NOMS_TYPES[t]}</h2>}
              <ul className="liste">{r.map((e) => <li key={e.id}><a href={`#/element/${e.id}`}><b>{titreDe(e)}</b>{e.type === 'lexique' && <small>{e.definition}</small>}</a></li>)}</ul>
            </section>
          );
        })
      ) : lexiqueSeul && (
        <dl className="lexique">
          {lexique.map((l) => (
            <div key={l.id}>
              <dt>{l.terme}{l.anglais && <em> ({l.anglais})</em>}</dt>
              <dd>{l.definition} {l.fiche && <a href={`#/fiche/${l.fiche}`}>Voir la fiche</a>}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/* ---------- Favoris et liste « à revoir » ---------- */
function Listes({ contenu }: { contenu: Contenu }) {
  const marques = useLiveQuery(() => db.marques.toArray(), [], []);
  const bloc = (liste: string, titre: string, vide: string) => {
    const els = marques.filter((m) => m.liste === liste).map((m) => contenu.parId.get(m.id)).filter(Boolean) as TElement[];
    return (
      <section>
        <h2>{titre} ({els.length})</h2>
        {els.length === 0 && <p className="note">{vide}</p>}
        <ul className="liste">{els.map((e) => <li key={e.id}><a href={`#/element/${e.id}`}><b>{titreDe(e)}</b><small>{NOMS_TYPES[e.type]}</small></a></li>)}</ul>
      </section>
    );
  };
  return (
    <div className="page">
      <h1>Mes listes</h1>
      {bloc('favori', '★ Favoris', 'Appuie sur ☆ dans une fiche ou une question pour l\'ajouter ici.')}
      {bloc('a_revoir', '⚑ À revoir', 'Appuie sur ⚐ pour mettre un élément de côté.')}
    </div>
  );
}

/* ---------- Réglages ---------- */
const TAILLES = [['Normale', 100], ['Grande', 112.5], ['Très grande', 125], ['Énorme', 140]] as const;

function Reglages({ theme, taille }: { theme: string; taille: number }) {
  const [message, setMessage] = useState('');
  return (
    <div className="page">
      <h1>Réglages</h1>
      <h2>Apparence</h2>
      <div className="seg" role="group" aria-label="Thème">
        {[['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']].map(([v, l]) => <button key={v} aria-pressed={theme === v} onClick={() => ecrireReglage('theme', v)}>{l}</button>)}
      </div>
      <h2>Taille du texte</h2>
      <div className="seg" role="group" aria-label="Taille du texte">
        {TAILLES.map(([l, v]) => <button key={v} aria-pressed={taille === v} onClick={() => ecrireReglage('taille', v)}>{l}</button>)}
      </div>
      <h2>Mes données</h2>
      <p className="note">Ta progression, tes listes et tes contenus importés sont stockés sur cet appareil seulement. Fais une sauvegarde de temps en temps : le navigateur peut les effacer.</p>
      {message && <p className="message" role="status">{message}</p>}
      <div className="ligne">
        <button className="btn y" onClick={async () => telecharger(`revision-marches-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, await exporterTout())}>Sauvegarder (fichier JSON)</button>
        <button className="btn g" onClick={async () => {
          try {
            const texte = await lireFichier('application/json,.json');
            if (!window.confirm('Restaurer cette sauvegarde remplace toutes les données actuelles de cet appareil. Continuer ?')) return;
            await restaurerTout(texte);
            setMessage('Sauvegarde restaurée.');
          } catch (e) { setMessage(`Restauration impossible : ${(e as Error).message}`); }
        }}>Restaurer une sauvegarde</button>
      </div>
      <h2>Autres</h2>
      <ul className="liste">
        <li><a href="#/listes"><b>Favoris et liste « à revoir »</b></a></li>
        <li><a href="#/clarifier"><b>À clarifier, imports et exports de contenu</b></a></li>
        <li><a href="#/lexique"><b>Lexique</b></a></li>
      </ul>
      <p className="note">Révision marchés · contenu : {CHAPITRES.length} chapitres. Fonctionne hors ligne une fois chargée.</p>
    </div>
  );
}

/* ---------- Coquille : en-tête, contenu, barre d'onglets ---------- */
const ONGLETS = [
  { chemin: '', nom: 'Accueil', icone: '⌂', actifs: ['', 'session', 'listes', 'reglages', 'clarifier', 'recherche', 'lexique'] },
  { chemin: 'apprendre', nom: 'Apprendre', icone: '▤', actifs: ['apprendre', 'chapitre', 'fiche', 'element'] },
  { chemin: 'entrainer', nom: 'S\'entraîner', icone: '✎', actifs: ['entrainer', 'cartes', 'questions', 'quiz', 'exercices', 'cas'] },
  { chemin: 'labo', nom: 'Labo', icone: '◔', actifs: ['labo'] },
  { chemin: 'marche', nom: 'Marché', icone: '↗', actifs: ['marche'] },
];

export default function App() {
  const route = useRoute();
  const contenu = useContenu();
  const reglages = useLiveQuery(() => db.reglages.toArray(), [], []);
  const theme = (reglages.find((r) => r.cle === 'theme')?.valeur as string) ?? 'auto';
  const taille = (reglages.find((r) => r.cle === 'taille')?.valeur as number) ?? 100;
  useEffect(() => {
    const racine = document.documentElement;
    if (theme === 'auto') racine.removeAttribute('data-theme'); else racine.setAttribute('data-theme', theme);
    racine.style.fontSize = `${taille}%`;
  }, [theme, taille]);

  const [page = '', arg] = route.chemin;
  let vue;
  switch (page) {
    case '': vue = <Accueil contenu={contenu} />; break;
    case 'apprendre': vue = <Apprendre contenu={contenu} />; break;
    case 'chapitre': vue = <Chapitre id={arg} contenu={contenu} />; break;
    case 'fiche': case 'element': vue = <PageElement id={arg} contenu={contenu} />; break;
    case 'entrainer': vue = <Entrainer contenu={contenu} />; break;
    case 'cartes': case 'questions': case 'quiz': case 'exercices': case 'cas': vue = <PageGenre genre={page} route={route} contenu={contenu} />; break;
    case 'session': vue = <Session key={arg} minutes={Number(arg) === 10 ? 10 : 2} contenu={contenu} />; break;
    case 'labo': vue = <Labo refOutil={arg} />; break;
    case 'marche': vue = <Marche />; break;
    case 'recherche': vue = <Recherche contenu={contenu} />; break;
    case 'lexique': vue = <Recherche key="lexique" contenu={contenu} lexiqueSeul />; break;
    case 'listes': vue = <Listes contenu={contenu} />; break;
    case 'clarifier': vue = <Clarifier contenu={contenu} />; break;
    case 'reglages': vue = <Reglages theme={theme} taille={taille} />; break;
    default: vue = <div className="page"><p>Page introuvable.</p><a className="btn g" href="#/">Accueil</a></div>;
  }
  return (
    <>
      <header className="entete">
        <a href="#/" className="marque">Révision marchés</a>
        <nav aria-label="Outils">
          <a href="#/recherche" aria-label="Recherche">⌕</a>
          <a href="#/listes" aria-label="Favoris et à revoir">★</a>
          <a href="#/reglages" aria-label="Réglages">⚙</a>
        </nav>
      </header>
      <main>{vue}</main>
      <nav className="onglets" aria-label="Navigation principale">
        {ONGLETS.map((o) => (
          <a key={o.chemin} href={`#/${o.chemin}`} aria-current={o.actifs.includes(page) ? 'page' : undefined}><i aria-hidden="true">{o.icone}</i>{o.nom}</a>
        ))}
      </nav>
    </>
  );
}
