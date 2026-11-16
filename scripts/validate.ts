// Validation du contenu, lancée avant chaque build :
// schéma, identifiants uniques, liens valides, formules KaTeX, chiffres de marché datés et sourcés, exercices recalculés.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import katex from 'katex';
import { FichierChapitre, Module, type TElement, type TFormule } from '../src/schema';
import { REGISTRE } from '../src/finance/registre';

const erreurs: string[] = [];
const err = (ou: string, quoi: string) => erreurs.push(`${ou} : ${quoi}`);

const modules = (JSON.parse(readFileSync('content/modules.json', 'utf8')) as unknown[]).map((m) => Module.parse(m));
const elements: TElement[] = [];
const chapitres = new Set<string>();

for (const dossier of readdirSync('content').filter((d) => d.startsWith('module-'))) {
  for (const fichier of readdirSync(join('content', dossier)).filter((f) => f.endsWith('.json'))) {
    const chemin = join('content', dossier, fichier);
    const res = FichierChapitre.safeParse(JSON.parse(readFileSync(chemin, 'utf8')));
    if (!res.success) {
      for (const i of res.error.issues) err(chemin, `${i.path.join('.')} → ${i.message}`);
      continue;
    }
    const { chapitre, elements: els } = res.data;
    if (!modules.some((m) => m.id === chapitre.module)) err(chemin, `module ${chapitre.module} inconnu`);
    if (chapitres.has(chapitre.id)) err(chemin, `chapitre ${chapitre.id} en double`);
    chapitres.add(chapitre.id);
    for (const e of els) {
      if (e.chapitre !== chapitre.id) err(e.id, `chapitre « ${e.chapitre} » ≠ fichier « ${chapitre.id} »`);
      if (e.module !== chapitre.module) err(e.id, 'module différent de celui du chapitre');
      if (!e.id.startsWith(chapitre.id + '.')) err(e.id, `l'identifiant doit commencer par ${chapitre.id}.`);
    }
    elements.push(...els);
  }
}

const ids = new Map<string, TElement>();
for (const e of elements) {
  if (ids.has(e.id)) err(e.id, 'identifiant en double');
  ids.set(e.id, e);
}

function verifierFormule(ou: string, f: TFormule) {
  for (const tex of [f.latex, ...Object.keys(f.legende)]) {
    try {
      katex.renderToString(tex, { throwOnError: true, displayMode: true });
    } catch (e) {
      err(ou, `formule invalide « ${tex} » : ${(e as Error).message}`);
    }
  }
}

// Une formule ne doit jamais apparaître dans le texte courant.
function sansFormule(ou: string, texte: string) {
  if (/\\frac|\\times|\\sum|\\text\{/.test(texte)) err(ou, 'formule LaTeX dans le texte courant');
}

for (const e of elements) {
  for (const l of e.liens) if (!ids.has(l)) err(e.id, `lien vers « ${l} » introuvable`);
  if ('fiche' in e && e.fiche && ids.get(e.fiche)?.type !== 'fiche') err(e.id, `fiche « ${e.fiche} » introuvable`);
  for (const v of Object.values(e)) if (typeof v === 'string') sansFormule(e.id, v);

  if (e.type === 'fiche') {
    e.formules.forEach((f) => verifierFormule(e.id, f));
    if (e.visuel?.type === 'outil' && !e.visuel.ref.startsWith('labo.')) err(e.id, "référence d'outil invalide");
    // Un exemple réel doit être daté et sourcé.
    if (!e.exemple_fictif && (e.chiffres.length === 0 || e.sources.length === 0))
      err(e.id, 'exemple non fictif : il faut des « chiffres » datés et des « sources »');
    if (e.chiffres.length > 0 && e.sources.length === 0) err(e.id, 'chiffres de marché sans source détaillée');
  }
  if (e.type === 'quiz' && e.forme === 'qcm' && e.bonne >= e.choix.length) err(e.id, 'indice de bonne réponse hors limites');
  if (e.type === 'exercice') {
    for (const [i, etape] of e.etapes.entries()) {
      if (etape.formule) verifierFormule(`${e.id} étape ${i + 1}`, etape.formule);
      if (etape.verif) {
        const fn = REGISTRE[etape.verif.fn];
        if (!fn) {
          err(e.id, `fonction de vérification inconnue : ${etape.verif.fn}`);
          continue;
        }
        const obtenu = fn(...etape.verif.args);
        if (Math.abs(obtenu - etape.verif.attendu) > etape.verif.tolerance)
          err(`${e.id} étape ${i + 1}`, `résultat recalculé ${obtenu} ≠ attendu ${etape.verif.attendu}`);
      }
    }
  }
}

const compte: Record<string, number> = {};
for (const e of elements) compte[e.type] = (compte[e.type] ?? 0) + 1;
console.log(`Contenu : ${chapitres.size} chapitres, ${elements.length} éléments`, compte);

if (erreurs.length) {
  console.error(`\n${erreurs.length} erreur(s) :`);
  for (const e of erreurs) console.error(' ✗ ' + e);
  process.exit(1);
}
console.log('Contenu valide ✓');
