// Le marché actuel : tableau de bord du mois, histoire, vue en 30 secondes, calendrier, impacts, archive des packs.
import { useState } from 'react';
import { db } from '../db';
import { PACKS_DEPOT, usePacks } from '../content';
import { PackActu, type TChiffreMarche, type TPackActu } from '../schema';
import { Md, copier, dateFr, telecharger } from '../lib';
import { dateValeur, useMarcheAuto, valeurTexte, variation, type Serie } from '../marche-auto';

const FLECHE = { hausse: '↗', baisse: '↘', stable: '→' } as const;
const GROUPES: TChiffreMarche['groupe'][] = ['Banques centrales', 'Taux courts', 'Inflation', 'Change', 'Taux longs', 'Matières premières et actions'];

function moisFr(mois: string) {
  return new Date(mois + '-15T12:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function Chiffre({ c }: { c: TChiffreMarche }) {
  return (
    <details className="chiffre">
      <summary>
        <span className="lib">{c.libelle}</span>
        <b>{c.valeur}</b>
        <span className={`tend ${c.tendance}`}>{FLECHE[c.tendance]} {c.tendance_texte}</span>
        <span className="quand">{dateFr(c.date)} · {c.source}</span>
      </summary>
      <p><b>Ce que c'est.</b> {c.definition}</p>
      <p><b>Pourquoi ça compte.</b> {c.pourquoi}</p>
      {c.url && <p><a href={c.url} target="_blank" rel="noreferrer">Voir la source</a></p>}
    </details>
  );
}

/** Demande à coller dans Claude (avec recherche web) pour obtenir le pack du mois suivant. */
function promptPack(modele: TPackActu): string {
  const aujourdhui = new Date();
  const mois = `${aujourdhui.getFullYear()}-${String(aujourdhui.getMonth() + 1).padStart(2, '0')}`;
  const exemple = { ...modele, chiffres: modele.chiffres.slice(0, 2), evenements: modele.evenements.slice(0, 1), calendrier: modele.calendrier.slice(0, 1), impacts: modele.impacts.slice(0, 1), sources: modele.sources.slice(0, 2), elements: [modele.elements.find((e) => e.type === 'question_entretien'), modele.elements.find((e) => e.type === 'quiz')].filter(Boolean) };
  return `Je prépare des entretiens de stage en finance de marché. Fais une recherche web et rédige mon « pack actu » du mois ${mois} : la photo des marchés sur une fenêtre glissante d'un mois, arrêtée à aujourd'hui (${aujourdhui.toISOString().slice(0, 10)}).

Règles non négociables :
1. Aucun chiffre inventé. Chaque chiffre est vérifié par la recherche, daté (date de la valeur, AAAA-MM-JJ) et sourcé (source officielle de préférence : BCE, Fed, Eurostat, BLS, Banque d'Angleterre ; sinon indique « source secondaire »). Si tu ne trouves pas un chiffre fiable, ne le mets pas.
2. Français, tutoiement, mots simples. Termes anglais du métier entre parenthèses et en italique.
3. Pédagogie : chaque chiffre a sa définition en une ligne et son « pourquoi ça compte ».
4. « histoire » : exactement 5 phrases, qui s'enchaînent logiquement (cause, réaction des banques centrales, conséquences sur les prix, France ou zone euro).
5. « vue_30s » : un paragraphe à dire à voix haute en 30 secondes, entre guillemets français.

Chiffres attendus (clés à reprendre telles quelles si le chiffre est disponible) : bce-depot, bce-refi, fed-funds, boe, estr, euribor-3m, euribor-12m, inflation-ze, inflation-ze-core, inflation-us, eurusd, eurgbp, usdjpy, oat-10, bund-10, oat-bund, ust-10, brent, cac40, eurostoxx50, sp500, vix, vstoxx.
Valeurs possibles de « groupe » : ${GROUPES.map((g) => `"${g}"`).join(', ')}.
Valeurs possibles de « tendance » : "hausse", "baisse", "stable".

Ajoute aussi : 5 à 8 événements marquants du mois, le calendrier des prochains rendez-vous (réunions BCE et Fed, publications d'inflation, d'emploi, de PIB), les impacts pour les clients d'une banque (emprunteurs, exportateurs, importateurs, placeurs), 5 questions d'entretien sur l'actualité avec leur solution et 10 questions de quiz (formes : "qcm", "vrai_faux", "numerique", "ordre").

Format de réponse (important, la réponse sera importée telle quelle dans mon application) :
- UN SEUL bloc de code \`\`\`json contenant UN objet, sans texte autour.
- "id" vaut "actu.${mois}", "mois" vaut "${mois}", "type" vaut "pack_actu", "version" vaut 1, "maj" et "arrete_le" valent la date du jour.
- Les éléments de "elements" ont un "id" qui commence par "m1.marche." (par exemple "m1.marche.q01", "m1.marche.z01"), "module": 1, "chapitre": "m1.marche". Le champ "fiche" est facultatif : ne le mets que si tu reprends un identifiant de l'exemple.
- Texte : mini-Markdown seulement (**gras**, *italique*).

Voici un extrait du pack précédent, qui montre la structure exacte à respecter (les listes ont été raccourcies) :
\`\`\`json
${JSON.stringify(exemple, null, 2)}
\`\`\``;
}

/* ---------- Les chiffres du jour, collectés automatiquement ---------- */
const GROUPES_AUTO: Serie['groupe'][] = ['Banques centrales', 'Taux courts', 'Inflation', 'Change', 'Taux longs', 'Matières premières'];
const FLECHE_AUTO = { hausse: '↗', baisse: '↘', stable: '→' } as const;

function SerieAuto({ s }: { s: Serie }) {
  const v = variation(s);
  return (
    <details className={`chiffre ${s.statut === 'ancien' ? 'ancien' : ''}`}>
      <summary>
        <span className="lib">{s.libelle}</span>
        <b>{valeurTexte(s)}</b>
        {v && <span className={`tend ${v.sens}`}>{FLECHE_AUTO[v.sens]} {v.texte}</span>}
        <span className="quand">{dateValeur(s.date)} · {s.source}{s.statut === 'ancien' && ' · source injoignable, dernière valeur connue'}</span>
      </summary>
      <p><b>Ce que c'est.</b> {s.definition}</p>
      <p><b>Pourquoi ça compte.</b> {s.pourquoi}</p>
      {s.note && <p className="note">{s.note}</p>}
      <p className="note">Relevé le {new Date(s.releve_le).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}. Données {s.frequence === 'mensuelle' ? 'mensuelles' : 'quotidiennes'}. <a href={s.url} target="_blank" rel="noreferrer">Voir la source</a></p>
    </details>
  );
}

function ChiffresDuJour() {
  const { marche, etat } = useMarcheAuto();
  return (
    <section className="chiffres-jour">
      <h2>Les chiffres du jour</h2>
      {etat === 'chargement' && !marche && <p className="note">Chargement…</p>}
      {etat === 'indisponible' && <p className="message">Les chiffres automatiques ne sont pas disponibles pour l'instant (hors ligne, ou première collecte pas encore faite). L'analyse du mois, plus bas, reste consultable.</p>}
      {marche && (
        <>
          <p className="note">
            Mis à jour automatiquement depuis la BCE, Eurostat et la Fed de Saint-Louis. Dernière collecte : {new Date(marche.genere_le).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}
            {etat === 'copie' && ' · copie enregistrée sur cet appareil (pas de connexion)'}. Appuie sur un chiffre pour sa définition.
          </p>
          {GROUPES_AUTO.map((g) => {
            const liste = Object.values(marche.series).filter((s) => s.groupe === g);
            if (!liste.length) return null;
            return <section key={g}><h3 className="groupe">{g}</h3>{liste.map((s) => <SerieAuto key={s.cle} s={s} />)}</section>;
          })}
        </>
      )}
    </section>
  );
}

export function Marche() {
  const packs = usePacks();
  const [mois, setMois] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [colle, setColle] = useState('');
  const [erreurs, setErreurs] = useState<string[]>([]);
  const pack = packs.find((p) => p.mois === mois) ?? packs[0];
  const dire = (m: string) => { setMessage(m); setTimeout(() => setMessage(''), 5000); };

  const importer = async () => {
    const bloc = colle.match(/```(?:json)?\s*([\s\S]*?)```/);
    let brut = (bloc ? bloc[1] : colle).trim();
    if (!bloc) brut = brut.slice(brut.indexOf('{'), brut.lastIndexOf('}') + 1);
    try {
      const res = PackActu.safeParse(JSON.parse(brut));
      if (!res.success) return setErreurs(res.error.issues.slice(0, 8).map((i) => `${i.path.join('.') || 'structure'} → ${i.message}`));
      await db.packs.put({ id: res.data.id, pack: res.data, date: Date.now() });
      setErreurs([]); setColle(''); setMois(res.data.mois);
      dire(`Pack de ${moisFr(res.data.mois)} importé sur cet appareil.`);
    } catch (e) {
      setErreurs([`Le texte collé n'est pas du JSON valide : ${(e as Error).message}`]);
    }
  };

  if (!pack) return <div className="page"><h1>Le marché actuel</h1><p>Aucun pack actu disponible.</p></div>;
  const age = Math.floor((Date.now() - new Date(pack.arrete_le + 'T12:00:00').getTime()) / 86_400_000);
  const importe = !PACKS_DEPOT.some((p) => p.mois === pack.mois && p.version === pack.version && p.arrete_le === pack.arrete_le);
  const questions = pack.elements.filter((e) => e.type === 'question_entretien').length;
  const quiz = pack.elements.filter((e) => e.type === 'quiz').length;

  return (
    <div className="page marche">
      <h1>Le marché actuel</h1>
      <ChiffresDuJour />

      <h2 className="titre-pack">L'analyse du mois : {moisFr(pack.mois)}</h2>
      <p className="note">Pack rédigé et vérifié, arrêté au {dateFr(pack.arrete_le)}{importe && ' · importé sur cet appareil'}. Chaque chiffre porte sa date et sa source.</p>
      {age > 21 && <p className="message">Ce pack a {age} jours : l'analyse a pu vieillir. Les chiffres du jour ci-dessus, eux, sont à jour. Pense à générer le pack du mois (en bas de page).</p>}
      {packs.length > 1 && (
        <div className="seg" role="group" aria-label="Archive des packs">
          {packs.map((p) => <button key={p.mois} aria-pressed={p.mois === pack.mois} onClick={() => setMois(p.mois)}>{moisFr(p.mois)}</button>)}
        </div>
      )}

      <section className="dire"><h2>Ta vue en 30 secondes</h2><Md>{pack.vue_30s}</Md></section>

      <h2>L'histoire du mois en 5 phrases</h2>
      <ol className="etapes">{pack.histoire.map((h, i) => <li key={i}><Md>{h}</Md></li>)}</ol>

      <details className="pack-chiffres">
        <summary>Les chiffres commentés du pack ({moisFr(pack.mois)}, arrêtés au {dateFr(pack.arrete_le)})</summary>
        <p className="note">Photo figée du mois, avec aussi les indices actions et le VIX, qui ne sont pas mis à jour automatiquement. Appuie sur un chiffre pour voir ce qu'il mesure.</p>
        {GROUPES.map((g) => {
          const liste = pack.chiffres.filter((c) => c.groupe === g);
          if (!liste.length) return null;
          return <section key={g}><h3 className="groupe">{g}</h3>{liste.map((c) => <Chiffre key={c.cle} c={c} />)}</section>;
        })}
      </details>

      <h2>Ce que ça change pour les clients d'une banque</h2>
      <div className="impacts">{pack.impacts.map((i) => <div key={i.client}><b>{i.client}</b><p>{i.texte}</p></div>)}</div>

      <h2>Les rendez-vous à suivre</h2>
      <ul className="agenda">{pack.calendrier.map((c, i) => <li key={i}><b>{c.date}</b><span>{c.evenement}</span><small>{c.pourquoi}</small></li>)}</ul>

      <h2>Les événements marquants</h2>
      <ul className="agenda">{pack.evenements.map((e, i) => <li key={i}><b>{dateFr(e.date)}</b><span>{e.titre}</span><small>{e.texte}</small></li>)}</ul>

      {pack === packs[0] && (questions > 0 || quiz > 0) && (
        <>
          <h2>S'entraîner sur l'actualité</h2>
          <div className="liens">
            {questions > 0 && <a href="#/questions?ch=m1.marche&go=1">{questions} questions d'entretien</a>}
            {quiz > 0 && <a href="#/quiz?ch=m1.marche&go=1">{quiz} quiz</a>}
            <a href="#/fiche/m1.marche.vue-30s">La méthode de la vue en 30 secondes</a>
          </div>
        </>
      )}

      <details className="sources">
        <summary>Sources ({pack.sources.length})</summary>
        <ul>{pack.sources.map((s, i) => <li key={i}>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.titre}</a> : s.titre}</li>)}</ul>
      </details>

      <h2>Mettre à jour (pack du mois)</h2>
      <p className="note">Copie la demande, colle-la dans Claude avec la recherche web activée, puis colle sa réponse ici. Les anciens packs restent consultables.</p>
      {message && <p className="message" role="status">{message}</p>}
      <button className="btn y large" onClick={async () => dire((await copier(promptPack(packs[0]))) ? 'Demande copiée. Colle-la dans Claude (recherche web activée).' : 'Copie impossible : autorise le presse-papiers.')}>Copier le prompt du pack actu</button>
      <label className="champ">Réponse de Claude
        <textarea rows={4} value={colle} onChange={(e) => { setColle(e.target.value); setErreurs([]); }} placeholder="```json … ```" />
      </label>
      {erreurs.length > 0 && <div className="retour ko"><b>Format à corriger :</b><ul>{erreurs.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
      <div className="ligne">
        <button className="btn g" disabled={!colle.trim()} onClick={importer}>Importer le pack</button>
        <button className="btn g" onClick={() => telecharger(`${pack.mois}.json`, JSON.stringify(pack, null, 2) + '\n')}>Exporter ce pack (format du dépôt)</button>
      </div>
      <p className="note">Pour l'intégrer définitivement : place le fichier exporté dans <code>content/actu/</code> du dépôt, puis <code>git push</code>.</p>
    </div>
  );
}
