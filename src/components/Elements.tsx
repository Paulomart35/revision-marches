// Affichage de chaque type d'élément : fiche, carte, question d'entretien, quiz, exercice, cas pratique.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import katex from 'katex';
import { useLiveQuery } from 'dexie-react-hooks';
import { basculerMarque, db, marquerFiche, noter, type Note } from '../db';
import { BOUTONS, delais, enregistrer } from '../srs';
import { MANQUES } from '../clarifier';
import { OUTILS } from '../tools';
import { Md, Points, dateFr, lireNombre, melanger, nf } from '../lib';
import { titreDe, type TCarte, type TCas, type TElement, type TExercice, type TFiche, type TFormule, type TQuestion, type TQuiz, type TVisuel } from '../schema';
import type { Contenu } from '../content';

/* ---------- Formule : bloc à part, légende, traduction en français ---------- */
const tex = (latex: string, bloc: boolean) => ({ __html: katex.renderToString(latex, { displayMode: bloc, throwOnError: false }) });

export function Formule({ f }: { f: TFormule }) {
  return (
    <div className="formule">
      {f.titre && <div className="t">{f.titre}</div>}
      {f.latex.split('\\qquad').map((morceau, i) => <div key={i} className="eq" dangerouslySetInnerHTML={tex(morceau.trim(), true)} />)}
      <dl>
        {Object.entries(f.legende).map(([symbole, sens]) => (
          <div key={symbole}><dt dangerouslySetInnerHTML={tex(symbole, false)} /><dd>{sens}</dd></div>
        ))}
      </dl>
      <p className="fr"><b>En français :</b> {f.en_francais}</p>
    </div>
  );
}

/* ---------- Visuels pilotés par les données ---------- */
function Chaine({ v }: { v: Extract<TVisuel, { type: 'chaine' }> }) {
  const [actif, setActif] = useState(-1);
  const [lecture, setLecture] = useState(false);
  useEffect(() => {
    if (!lecture) return;
    if (actif >= v.etapes.length - 1) {
      setLecture(false);
      return;
    }
    const t = setTimeout(() => setActif((a) => a + 1), actif < 0 ? 100 : 1300);
    return () => clearTimeout(t);
  }, [lecture, actif, v.etapes.length]);
  return (
    <div>
      <ol className="chaine">
        {v.etapes.map((e, i) => (
          <li key={i} className={i <= actif ? 'on' : ''} onClick={() => { setLecture(false); setActif(i); }}>
            <b>{e.titre}</b>
            <span>{e.texte}</span>
          </li>
        ))}
      </ol>
      <button className="btn g" onClick={() => { setActif(-1); setLecture(true); }}>▶ Dérouler la chaîne</button>
    </div>
  );
}

export function Visuel({ v }: { v: TVisuel }) {
  let corps: ReactNode;
  if (v.type === 'outil') corps = OUTILS[v.ref]?.rendu() ?? <p className="note">Outil « {v.ref} » indisponible.</p>;
  else if (v.type === 'chaine') corps = <Chaine v={v} />;
  else if (v.type === 'tableau')
    corps = (
      <div className="tableau">
        <table>
          <thead><tr>{v.colonnes.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
          <tbody>
            {v.lignes.map((l, i) => (
              <tr key={i}>{l.map((c, j) => <td key={j} data-l={v.colonnes[j]}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  else {
    const max = Math.max(...v.barres.map((b) => Math.abs(b.valeur))) || 1;
    corps = (
      <div className="barres">
        {v.barres.map((b) => (
          <div key={b.libelle}><span>{b.libelle}</span><i style={{ width: `${(Math.abs(b.valeur) / max) * 100}%` }} /><span className="n">{nf(b.valeur, 1)} {v.unite}</span></div>
        ))}
      </div>
    );
  }
  return <figure className="visuel">{corps}{v.legende && <figcaption>{v.legende}</figcaption>}</figure>;
}

/* ---------- Bouton « Pas clair ? » ---------- */
export function PasClair({ id }: { id: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [manques, setManques] = useState<string[]>([]);
  const [commentaire, setCommentaire] = useState('');
  const [fait, setFait] = useState(false);
  const ouvrir = () => {
    // On capture la sélection de texte au moment de l'appui : c'est « la phrase exacte qui pose problème ».
    setPhrase((window.getSelection()?.toString() ?? '').trim().slice(0, 400));
    setOuvert(true);
    setFait(false);
  };
  const envoyer = async () => {
    await db.clarifs.add({ elementId: id, manques, commentaire: commentaire.trim(), phrase, date: Date.now(), statut: 'ouvert' });
    setFait(true);
    setManques([]);
    setCommentaire('');
    setTimeout(() => setOuvert(false), 900);
  };
  return (
    <>
      <button className="btn g pasclair" onPointerDown={(e) => e.preventDefault()} onClick={ouvrir}>Pas clair ?</button>
      {ouvert && (
        <div className="voile" onClick={() => setOuvert(false)}>
          <div className="feuille" role="dialog" aria-label="Pas clair ?" onClick={(e) => e.stopPropagation()}>
            <h3>Qu'est-ce qui manque ?</h3>
            <div className="cases">
              {MANQUES.map((m) => (
                <label key={m} className={manques.includes(m) ? 'on' : ''}>
                  <input type="checkbox" checked={manques.includes(m)} onChange={() => setManques(manques.includes(m) ? manques.filter((x) => x !== m) : [...manques, m])} />
                  {m}
                </label>
              ))}
            </div>
            <label className="champ">La phrase qui pose problème (facultatif)
              <textarea rows={2} value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder="Astuce : sélectionne le texte dans la fiche avant d'appuyer sur « Pas clair ? »" />
            </label>
            <label className="champ">Précision (facultatif)
              <textarea rows={2} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
            </label>
            <div className="ligne">
              <button className="btn g" onClick={() => setOuvert(false)}>Annuler</button>
              <button className="btn y" onClick={envoyer} disabled={fait}>{fait ? 'Ajouté ✓' : 'Ajouter à « À clarifier »'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- Favori / à revoir ---------- */
export function Marques({ id }: { id: string }) {
  const marques = useLiveQuery(() => db.marques.where('id').equals(id).toArray(), [id], []);
  const a = (l: string) => marques.some((m) => m.liste === l);
  return (
    <span className="marques">
      <button aria-pressed={a('favori')} onClick={() => basculerMarque(id, 'favori')} title="Favori">{a('favori') ? '★' : '☆'}</button>
      <button aria-pressed={a('a_revoir')} onClick={() => basculerMarque(id, 'a_revoir')} title="À revoir">{a('a_revoir') ? '⚑' : '⚐'}</button>
    </span>
  );
}

const LienFiche = ({ id, contenu }: { id?: string; contenu: Contenu }) => {
  const f = id ? contenu.parId.get(id) : undefined;
  return f ? <a className="lienfiche" href={`#/fiche/${f.id}`}>→ Voir la fiche : {titreDe(f)}</a> : null;
};

function Sources({ e }: { e: TElement }) {
  if (!e.sources.length && !e.chiffres.length) return null;
  return (
    <details className="sources">
      <summary>Sources et chiffres datés</summary>
      {e.chiffres.length > 0 && (
        <ul>{e.chiffres.map((c, i) => <li key={i}>{c.libelle} : <b>{c.valeur}</b> ({dateFr(c.date)}, {c.source})</li>)}</ul>
      )}
      <ul>{e.sources.map((s, i) => <li key={i}>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.titre}</a> : s.titre}</li>)}</ul>
    </details>
  );
}

/* ---------- Fiche « Apprendre » : toujours le même gabarit, dans le même ordre ---------- */
export function Fiche({ f, contenu }: { f: TFiche; contenu: Contenu }) {
  const etat = useLiveQuery(() => db.fiches.get(f.id), [f.id]);
  useEffect(() => { void marquerFiche(f.id, 'vue'); }, [f.id]);
  const liees = contenu.tous.filter((e) => 'fiche' in e && e.fiche === f.id);
  const nb = (t: string) => liees.filter((e) => e.type === t).length;
  return (
    <article className="fiche">
      <header>
        <div className="meta"><Points n={f.difficulte} /><Marques id={f.id} /></div>
        <h1>{f.titre}</h1>
      </header>
      <section className="cle"><h2>En une phrase</h2><Md>{f.une_phrase}</Md></section>
      <section><h2>En 30 secondes</h2><Md>{f.trente_secondes}</Md></section>
      <section className="analogie"><h2>L'analogie</h2><Md>{f.analogie}</Md></section>
      {f.visuel && <section><h2>{f.visuel.type === 'outil' ? 'À manipuler' : 'Le schéma'}</h2><Visuel v={f.visuel} /></section>}
      <section>
        <h2>L'exemple chiffré {f.exemple_fictif && <span className="pastille">exemple fictif</span>}</h2>
        <ol className="etapes">{f.exemple_chiffre.map((e, i) => <li key={i}><Md>{e}</Md></li>)}</ol>
      </section>
      {f.formules.length > 0 && <section><h2>{f.formules.length > 1 ? 'Les formules' : 'La formule'}</h2>{f.formules.map((x, i) => <Formule key={i} f={x} />)}</section>}
      <details className="deuxmin"><summary>En 2 minutes (version complète)</summary><Md>{f.deux_minutes}</Md></details>
      <section className="piege"><h2>Le piège</h2><Md>{f.piege}</Md></section>
      <section className="dire"><h2>À dire en entretien</h2><Md>{f.a_dire_en_entretien}</Md></section>
      {f.liens.length > 0 && (
        <section><h2>Notions liées</h2>
          <div className="liens">{f.liens.map((l) => { const c = contenu.parId.get(l); return c ? <a key={l} href={`#/fiche/${l}`}>{titreDe(c)}</a> : null; })}</div>
        </section>
      )}
      <Sources e={f} />
      {liees.length > 0 && (
        <section><h2>S'entraîner sur cette fiche</h2>
          <div className="liens">
            {nb('carte') > 0 && <a href={`#/cartes?fiche=${f.id}`}>{nb('carte')} carte(s)</a>}
            {nb('question_entretien') > 0 && <a href={`#/questions?fiche=${f.id}`}>{nb('question_entretien')} question(s) d'entretien</a>}
            {nb('quiz') > 0 && <a href={`#/quiz?fiche=${f.id}`}>{nb('quiz')} quiz</a>}
            {liees.filter((e) => e.type === 'exercice' || e.type === 'cas_pratique').map((e) => <a key={e.id} href={`#/element/${e.id}`}>{titreDe(e)}</a>)}
          </div>
        </section>
      )}
      <footer className="pied">
        <button className={`btn ${etat?.statut === 'comprise' ? 'ok' : 'y'}`} onClick={() => db.fiches.put({ id: f.id, statut: etat?.statut === 'comprise' ? 'vue' : 'comprise', date: Date.now() })}>
          {etat?.statut === 'comprise' ? '✓ Comprise (appuie pour annuler)' : 'Je sais l\'expliquer'}
        </button>
        <PasClair id={f.id} />
        <small>Mise à jour le {dateFr(f.maj)} · version {f.version}{contenu.modifies.has(f.id) && ' · version importée'}</small>
      </footer>
    </article>
  );
}

/* ---------- Carte de révision ---------- */
export function Carte({ c, contenu, onSuite }: { c: TCarte; contenu: Contenu; onSuite?: () => void }) {
  const [verso, setVerso] = useState(false);
  const etat = useLiveQuery(() => db.cartes.get(c.id), [c.id]);
  useEffect(() => setVerso(false), [c.id]);
  const d = useMemo(() => delais(etat?.carte, new Date()), [etat, verso]);
  return (
    <div className="carte">
      <div className="face recto"><small>Question</small><Md>{c.recto}</Md></div>
      {verso ? (
        <>
          <div className="face verso"><small>Réponse</small><Md>{c.verso}</Md><LienFiche id={c.fiche} contenu={contenu} /></div>
          <div className="notes n4">
            {BOUTONS.map((b) => (
              <button key={b.note} className={b.classe} onClick={async () => { await enregistrer(c.id, b.note); onSuite?.(); }}>
                {b.libelle}<small>{d[b.note]}</small>
              </button>
            ))}
          </div>
          <PasClair id={c.id} />
        </>
      ) : (
        <button className="btn y large" onClick={() => setVerso(true)}>Retourner la carte</button>
      )}
    </div>
  );
}

/* ---------- Question d'entretien ---------- */
const NOTES: { note: Note; libelle: string; classe: string }[] = [
  { note: 'pas', libelle: 'Je ne savais pas', classe: 'ko' },
  { note: 'moitie', libelle: 'À moitié', classe: 'dur' },
  { note: 'savais', libelle: 'Je savais', classe: 'ok' },
];

export function Question({ q, contenu, onSuite }: { q: TQuestion; contenu: Contenu; onSuite?: () => void }) {
  const [vu, setVu] = useState(false);
  useEffect(() => setVu(false), [q.id]);
  return (
    <div className="question">
      <div className="meta"><Points n={q.difficulte} /><Marques id={q.id} /></div>
      <h1>{q.question}</h1>
      {!vu ? (
        <>
          <p className="note">Réponds à voix haute, comme en entretien, puis dévoile la solution.</p>
          <button className="btn y large" onClick={() => setVu(true)}>Voir la solution</button>
        </>
      ) : (
        <>
          <section className="dire"><h2>Réponse modèle</h2><Md>{q.reponse_modele}</Md></section>
          <section><h2>Points clés à citer</h2><ul className="coches">{q.points_cles.map((p, i) => <li key={i}>{p}</li>)}</ul></section>
          <section className="piege"><h2>Le piège</h2><Md>{q.piege}</Md></section>
          <LienFiche id={q.fiche} contenu={contenu} />
          <div className="notes n3">
            {NOTES.map((n) => (
              <button key={n.note} className={n.classe} onClick={async () => { await noter(q.id, 'question', n.note); onSuite?.(); }}>{n.libelle}</button>
            ))}
          </div>
          <PasClair id={q.id} />
        </>
      )}
    </div>
  );
}

/* ---------- Quiz : QCM, vrai/faux, numérique, ordre ---------- */
export function Quiz({ q, contenu, onSuite }: { q: TQuiz; contenu: Contenu; onSuite?: () => void }) {
  const [reponse, setReponse] = useState<null | { juste: boolean; choix?: number }>(null);
  const [saisie, setSaisie] = useState('');
  const melange = useMemo(() => (q.forme === 'ordre' ? melangerDifferent(q.etapes) : []), [q]);
  const [ordre, setOrdre] = useState<string[]>(melange);
  useEffect(() => { setReponse(null); setSaisie(''); setOrdre(melange); }, [q.id, melange]);
  const valider = (juste: boolean, choix?: number) => {
    setReponse({ juste, choix });
    void noter(q.id, 'quiz', juste ? 'savais' : 'pas');
  };
  const bouger = (i: number, sens: number) => {
    const o = [...ordre];
    [o[i], o[i + sens]] = [o[i + sens], o[i]];
    setOrdre(o);
  };
  const classe = (i: number, bonne: number) => (!reponse ? '' : i === bonne ? 'good' : reponse.choix === i ? 'bad' : '');
  return (
    <div className="quiz">
      <div className="meta"><Points n={q.difficulte} /><Marques id={q.id} /></div>
      <h1>{q.enonce}</h1>
      {q.forme === 'qcm' && (
        <div className="choix">{q.choix.map((c, i) => <button key={i} disabled={!!reponse} className={classe(i, q.bonne)} onClick={() => valider(i === q.bonne, i)}>{c}</button>)}</div>
      )}
      {q.forme === 'vrai_faux' && (
        <div className="choix deux">{['Vrai', 'Faux'].map((c, i) => <button key={c} disabled={!!reponse} className={classe(i, q.vrai ? 0 : 1)} onClick={() => valider((i === 0) === q.vrai, i)}>{c}</button>)}</div>
      )}
      {q.forme === 'numerique' && (
        <form className="numerique" onSubmit={(e) => { e.preventDefault(); const n = lireNombre(saisie); if (!Number.isNaN(n) && saisie.trim()) valider(Math.abs(n - q.reponse) <= q.tolerance); }}>
          <input inputMode="text" value={saisie} onChange={(e) => setSaisie(e.target.value)} disabled={!!reponse} placeholder="Ta réponse" aria-label="Ta réponse" />
          <span>{q.unite}</span>
          <button className="btn y" disabled={!!reponse || !saisie.trim()}>Valider</button>
        </form>
      )}
      {q.forme === 'ordre' && (
        <>
          <ol className="ordre">
            {ordre.map((e, i) => (
              <li key={e} className={reponse ? (q.etapes[i] === e ? 'good' : 'bad') : ''}>
                <span>{e}</span>
                {!reponse && <span className="fleches"><button disabled={i === 0} onClick={() => bouger(i, -1)} aria-label="Monter">↑</button><button disabled={i === ordre.length - 1} onClick={() => bouger(i, 1)} aria-label="Descendre">↓</button></span>}
              </li>
            ))}
          </ol>
          {!reponse && <button className="btn y large" onClick={() => valider(ordre.every((e, i) => e === q.etapes[i]))}>Valider l'ordre</button>}
        </>
      )}
      {reponse && (
        <div className={`retour ${reponse.juste ? 'ok' : 'ko'}`}>
          <b>{reponse.juste ? 'Juste.' : 'Pas tout à fait.'}</b>
          {q.forme === 'numerique' && <p>Réponse attendue : <b>{nf(q.reponse, Number.isInteger(q.reponse) ? 0 : 2)} {q.unite}</b></p>}
          {q.forme === 'ordre' && !reponse.juste && <ol>{q.etapes.map((e) => <li key={e}>{e}</li>)}</ol>}
          <Md>{q.explication}</Md>
          <LienFiche id={q.fiche} contenu={contenu} />
          <div className="ligne"><PasClair id={q.id} />{onSuite && <button className="btn y" onClick={onSuite}>Suivant</button>}</div>
        </div>
      )}
    </div>
  );
}
function melangerDifferent(t: string[]): string[] {
  for (let i = 0; i < 10; i++) {
    const m = melanger(t);
    if (m.some((e, j) => e !== t[j])) return m;
  }
  return [...t].reverse();
}

/* ---------- Exercice chiffré : correction dévoilée une étape à la fois ---------- */
export function Exercice({ x, contenu, onSuite }: { x: TExercice; contenu: Contenu; onSuite?: () => void }) {
  const [n, setN] = useState(0);
  useEffect(() => setN(0), [x.id]);
  const fini = n >= x.etapes.length;
  return (
    <div className="exercice">
      <div className="meta"><Points n={x.difficulte} /><Marques id={x.id} /></div>
      <h1>{x.titre}</h1>
      <section className="cle"><h2>Énoncé</h2><Md>{x.enonce}</Md></section>
      <ol className="correction">
        {x.etapes.slice(0, n).map((e, i) => (
          <li key={i}>
            <h3>{e.titre}</h3>
            <Md>{e.texte}</Md>
            {e.formule && <Formule f={e.formule} />}
            {e.resultat && <p className="resultat">{e.resultat}</p>}
          </li>
        ))}
      </ol>
      {!fini ? (
        <button className="btn y large" onClick={() => setN(n + 1)}>
          {n === 0 ? 'Cherche d\'abord, puis dévoile l\'étape 1' : `Étape suivante (${n + 1} sur ${x.etapes.length})`}
        </button>
      ) : (
        <>
          <section className="piege"><h2>Erreurs à éviter</h2><ul>{x.erreurs_a_eviter.map((e, i) => <li key={i}>{e}</li>)}</ul></section>
          <LienFiche id={x.fiche} contenu={contenu} />
          <div className="notes n3">
            {NOTES.map((b) => <button key={b.note} className={b.classe} onClick={async () => { await noter(x.id, 'exercice', b.note); onSuite?.(); }}>{b.libelle}</button>)}
          </div>
          <PasClair id={x.id} />
        </>
      )}
    </div>
  );
}

/* ---------- Cas pratique client : questions → proposition → scénario défavorable → faisabilité ---------- */
export function Cas({ k, contenu, onSuite }: { k: TCas; contenu: Contenu; onSuite?: () => void }) {
  const [n, setN] = useState(0);
  useEffect(() => setN(0), [k.id]);
  const etapes: { titre: string; classe: string; corps: ReactNode }[] = [
    { titre: '1. Les questions à poser au client', classe: '', corps: <ul className="coches">{k.questions_a_poser.map((q, i) => <li key={i}>{q}</li>)}</ul> },
    { titre: '2. Ce que tu proposes', classe: 'dire', corps: <Md>{k.proposition}</Md> },
    { titre: '3. Le scénario défavorable à expliquer', classe: 'piege', corps: <Md>{k.scenario_defavorable}</Md> },
    { titre: '4. La faisabilité à vérifier', classe: '', corps: <Md>{k.faisabilite}</Md> },
  ];
  return (
    <div className="exercice">
      <div className="meta"><Points n={k.difficulte} /><Marques id={k.id} /></div>
      <h1>{k.titre}</h1>
      <section className="cle"><h2>La situation</h2><Md>{k.situation}</Md></section>
      {etapes.slice(0, n).map((e) => <section key={e.titre} className={e.classe}><h2>{e.titre}</h2>{e.corps}</section>)}
      {n < etapes.length ? (
        <button className="btn y large" onClick={() => setN(n + 1)}>{n === 0 ? 'Réfléchis, puis dévoile : ' : 'Suite : '}{etapes[n].titre.slice(3)}</button>
      ) : (
        <>
          <LienFiche id={k.fiche} contenu={contenu} />
          <div className="notes n3">
            {NOTES.map((b) => <button key={b.note} className={b.classe} onClick={async () => { await noter(k.id, 'cas', b.note); onSuite?.(); }}>{b.libelle}</button>)}
          </div>
          <PasClair id={k.id} />
        </>
      )}
    </div>
  );
}

/** Affiche n'importe quel élément avec le bon composant. */
export function Rendu({ e, contenu, onSuite }: { e: TElement; contenu: Contenu; onSuite?: () => void }) {
  switch (e.type) {
    case 'fiche': return <><Fiche f={e} contenu={contenu} />{onSuite && <button className="btn y large" onClick={onSuite}>Continuer</button>}</>;
    case 'carte': return <Carte c={e} contenu={contenu} onSuite={onSuite} />;
    case 'question_entretien': return <Question q={e} contenu={contenu} onSuite={onSuite} />;
    case 'quiz': return <Quiz q={e} contenu={contenu} onSuite={onSuite} />;
    case 'exercice': return <Exercice x={e} contenu={contenu} onSuite={onSuite} />;
    case 'cas_pratique': return <Cas k={e} contenu={contenu} onSuite={onSuite} />;
    case 'lexique': return (
      <div className="question">
        <h1>{e.terme}</h1>
        {e.anglais && <p className="note"><em>{e.anglais}</em></p>}
        <section className="cle"><Md>{e.definition}</Md></section>
        <LienFiche id={e.fiche} contenu={contenu} />
        <PasClair id={e.id} />
      </div>
    );
  }
}
