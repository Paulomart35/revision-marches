// Le marché actuel : la photo du mois (pack actu), sans aucune donnée en temps réel.
import { useState } from 'react';
import { usePacks } from '../content';
import type { TChiffreMarche } from '../schema';
import { Md, dateFr } from '../lib';

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

export function Marche() {
  const packs = usePacks();
  const [mois, setMois] = useState<string | null>(null);
  const pack = packs.find((p) => p.mois === mois) ?? packs[0];

  if (!pack) return <div className="page"><h1>Le marché actuel</h1><p>Aucun pack actu disponible.</p></div>;
  const age = Math.floor((Date.now() - new Date(pack.arrete_le + 'T12:00:00').getTime()) / 86_400_000);
  const questions = pack.elements.filter((e) => e.type === 'question_entretien').length;
  const quiz = pack.elements.filter((e) => e.type === 'quiz').length;

  return (
    <div className="page marche">
      <h1>Le marché actuel</h1>
      <p className="note">Photo arrêtée au {dateFr(pack.arrete_le)}. Chaque chiffre porte sa date et sa source.</p>
      {age > 21 && <p className="message">Cette photo a {age} jours : avant un entretien, vérifie les chiffres clés (taux de la BCE et de la Fed, inflation, EUR/USD).</p>}
      {packs.length > 1 && (
        <div className="seg" role="group" aria-label="Archive des packs">
          {packs.map((p) => <button key={p.mois} aria-pressed={p.mois === pack.mois} onClick={() => setMois(p.mois)}>{moisFr(p.mois)}</button>)}
        </div>
      )}

      <section className="dire"><h2>Ta vue en 30 secondes</h2><Md>{pack.vue_30s}</Md></section>

      <h2>L'histoire du mois en 5 phrases</h2>
      <ol className="etapes">{pack.histoire.map((h, i) => <li key={i}><Md>{h}</Md></li>)}</ol>

      <h2>Le tableau de bord</h2>
      <p className="note">Appuie sur un chiffre pour voir ce qu'il mesure et pourquoi il compte.</p>
      {GROUPES.map((g) => {
        const liste = pack.chiffres.filter((c) => c.groupe === g);
        if (!liste.length) return null;
        return <section key={g}><h3 className="groupe">{g}</h3>{liste.map((c) => <Chiffre key={c.cle} c={c} />)}</section>;
      })}

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
    </div>
  );
}
