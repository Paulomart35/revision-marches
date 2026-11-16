// Liste « À clarifier » : copier le prompt pour Claude, importer sa réponse, historique et exports.
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Contenu } from '../content';
import { annuler, appliquer, clarifsEnMarkdown, exportContenusModifies, lireReponse, promptClarification, type Lecture } from '../clarifier';
import { copier, dateFr, telecharger } from '../lib';
import { NOMS_TYPES, titreDe, type TElement } from '../schema';

const CHAMPS_APERCU = ['titre', 'une_phrase', 'trente_secondes', 'analogie', 'deux_minutes', 'piege', 'a_dire_en_entretien', 'recto', 'verso', 'question', 'reponse_modele', 'enonce', 'explication', 'definition', 'situation', 'proposition'];

function Apercu({ avant, apres }: { avant: TElement | undefined; apres: TElement }) {
  const a = (avant ?? {}) as Record<string, unknown>;
  const b = apres as Record<string, unknown>;
  const champs = CHAMPS_APERCU.filter((c) => typeof b[c] === 'string' && a[c] !== b[c]);
  const autres = Object.keys(b).filter((c) => !CHAMPS_APERCU.includes(c) && !['maj', 'version'].includes(c) && JSON.stringify(a[c]) !== JSON.stringify(b[c]));
  return (
    <div className="apercu">
      <h3>{avant ? 'Remplace' : 'Ajoute'} : {NOMS_TYPES[apres.type]} « {titreDe(apres)} »</h3>
      <small>{apres.id} · version {avant?.version ?? '—'} → {apres.version}</small>
      {champs.map((c) => (
        <div key={c} className="diff">
          <b>{c}</b>
          {typeof a[c] === 'string' && <p className="avant">{a[c] as string}</p>}
          <p className="apres">{b[c] as string}</p>
        </div>
      ))}
      {autres.length > 0 && <p className="note">Autres champs modifiés : {autres.join(', ')}.</p>}
      {champs.length === 0 && autres.length === 0 && <p className="note">Aucune différence avec la version actuelle.</p>}
    </div>
  );
}

export function Clarifier({ contenu }: { contenu: Contenu }) {
  const clarifs = useLiveQuery(() => db.clarifs.orderBy('n').reverse().toArray(), [], []);
  const overrides = useLiveQuery(() => db.overrides.toArray(), [], []);
  const [choix, setChoix] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const [sujet, setSujet] = useState('');
  const [colle, setColle] = useState('');
  const [lecture, setLecture] = useState<Lecture | null>(null);

  const ouverts = clarifs.filter((c) => c.statut === 'ouvert');
  const selection = ouverts.filter((c) => choix.includes(c.n!));
  const dire = (m: string) => { setMessage(m); setTimeout(() => setMessage(''), 4000); };
  const items = (liste: typeof clarifs) => liste.map((clarif) => {
    const element = clarif.elementId ? contenu.parId.get(clarif.elementId) : undefined;
    return { clarif, element, titre: element ? titreDe(element) : clarif.commentaire };
  });

  const copierPrompt = async () => {
    const cible = selection.length ? selection : ouverts;
    const ok = await copier(promptClarification(items(cible)));
    dire(ok ? `Prompt copié (${cible.length} demande${cible.length > 1 ? 's' : ''}). Colle-le dans Claude, puis reviens importer sa réponse.` : 'Copie impossible : autorise l\'accès au presse-papiers.');
  };

  return (
    <div className="page">
      <h1>À clarifier</h1>
      <p className="note">1. Appuie sur « Pas clair ? » dans une fiche. 2. Copie le prompt ici et colle-le dans Claude. 3. Colle sa réponse ci-dessous pour remplacer l'explication.</p>
      {message && <p className="message" role="status">{message}</p>}

      <h2>Mes demandes ({ouverts.length})</h2>
      {ouverts.length === 0 && <p>Rien pour l'instant.</p>}
      <ul className="liste clarifs">
        {items(ouverts).map(({ clarif, element, titre }) => (
          <li key={clarif.n}>
            <label>
              <input type="checkbox" checked={choix.includes(clarif.n!)} onChange={() => setChoix(choix.includes(clarif.n!) ? choix.filter((x) => x !== clarif.n) : [...choix, clarif.n!])} />
              <span>
                <b>{element ? `${NOMS_TYPES[element.type]} — ${titre}` : `Notion à ajouter — ${titre}`}</b>
                <small>{[clarif.manques.join(', '), clarif.phrase && `« ${clarif.phrase} »`, element && clarif.commentaire].filter(Boolean).join(' · ') || 'Sans précision'}</small>
              </span>
            </label>
            <button className="mini" onClick={() => db.clarifs.delete(clarif.n!)} aria-label="Supprimer">✕</button>
          </li>
        ))}
      </ul>
      <div className="ligne">
        <button className="btn y" disabled={!ouverts.length} onClick={copierPrompt}>Copier le prompt pour Claude{selection.length ? ` (${selection.length})` : ouverts.length ? ' (tout)' : ''}</button>
        <button className="btn g" disabled={!clarifs.length} onClick={() => telecharger('a-clarifier.md', clarifsEnMarkdown(items(clarifs)), 'text/markdown')}>Exporter en Markdown</button>
      </div>

      <h2>Ajoute une notion</h2>
      <label className="champ">Décris le sujet qui manque
        <textarea rows={2} value={sujet} onChange={(e) => setSujet(e.target.value)} placeholder="Exemple : la différence entre taux fixe et taux variable pour un emprunteur" />
      </label>
      <button className="btn g" disabled={!sujet.trim()} onClick={async () => { await db.clarifs.add({ elementId: null, manques: [], commentaire: sujet.trim(), phrase: '', date: Date.now(), statut: 'ouvert' }); setSujet(''); dire('Ajouté à tes demandes.'); }}>Ajouter à mes demandes</button>

      <h2>Importer la réponse de Claude</h2>
      <label className="champ">Colle ici la réponse complète
        <textarea rows={5} value={colle} onChange={(e) => { setColle(e.target.value); setLecture(null); }} placeholder="```json … ```" />
      </label>
      <button className="btn g" disabled={!colle.trim()} onClick={() => setLecture(lireReponse(colle))}>Vérifier le format</button>
      {lecture && (
        <div className="import">
          {lecture.erreurs.length > 0 && <div className="retour ko"><b>{lecture.erreurs.length} problème(s) :</b><ul>{lecture.erreurs.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
          {lecture.elements.map((e) => <Apercu key={e.id} avant={contenu.parId.get(e.id)} apres={e} />)}
          {lecture.elements.length > 0 && lecture.erreurs.length === 0 && (
            <button className="btn y large" onClick={async () => { await appliquer(lecture.elements, contenu.parId); setColle(''); setLecture(null); setChoix([]); dire('Importé. L\'ancienne version est conservée dans l\'historique.'); }}>
              Remplacer ({lecture.elements.length} élément{lecture.elements.length > 1 ? 's' : ''})
            </button>
          )}
        </div>
      )}

      <h2>Contenus importés sur cet appareil ({overrides.length})</h2>
      {overrides.length === 0 && <p>Aucun.</p>}
      <ul className="liste clarifs">
        {overrides.map((o) => (
          <li key={o.id}>
            <span><a href={`#/element/${o.id}`}><b>{titreDe(o.element)}</b></a><small>{o.id} · importé le {dateFr(o.date)} · {o.historique.length} version(s) précédente(s)</small></span>
            <button className="mini" onClick={() => annuler(o.id)}>Retour arrière</button>
          </li>
        ))}
      </ul>
      <button className="btn g" disabled={!overrides.length} onClick={async () => telecharger(`contenus-modifies-${new Date().toISOString().slice(0, 10)}.json`, await exportContenusModifies())}>Exporter les contenus modifiés (format du dépôt)</button>
      <p className="note">Ces contenus ne vivent que sur cet appareil. Pour les retrouver partout, exporte-les puis intègre-les au dépôt avec <code>npm run integrer fichier.json</code> avant le prochain déploiement.</p>
    </div>
  );
}
