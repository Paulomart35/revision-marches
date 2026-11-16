// « Pas clair ? » : fabrication du prompt pour Claude, lecture et application de sa réponse.
import katex from 'katex';
import { db, type Clarif } from './db';
import { ELEMENTS_DEPOT } from './content';
import { Element, NOMS_TYPES, type TElement } from './schema';

export const MANQUES = [
  'Un schéma', 'Une analogie', 'Un exemple chiffré', 'Plus simple', 'Plus technique',
  'Une étape sautée', 'Je ne comprends pas un mot', 'Autre',
];

const CONSIGNES = `Consignes pédagogiques (non négociables) :
1. Pédagogie avant tout : pars de zéro, définis chaque terme à sa première apparition, avance par petites étapes, ne saute aucun raisonnement. Rien n'est « évident ».
2. Toujours concret : au moins un exemple chiffré réaliste et une analogie de la vie courante.
3. Formules : jamais dans le texte courant. Uniquement dans le champ « formules » (LaTeX compatible KaTeX), avec la légende de chaque symbole et une phrase « en_francais ».
4. Toujours finir par « a_dire_en_entretien » : une formulation prête à être dite à voix haute, en mots simples.
5. Toujours signaler le piège : l'erreur classique ou la confusion fréquente.
6. Langue : français, tutoiement. Termes anglais du métier entre parenthèses et en italique : couverture en delta (*delta hedging*).
7. Exactitude : aucun chiffre inventé. Tout chiffre de marché réel est daté et sourcé (champs « chiffres » et « sources »). Un exemple inventé est annoncé comme « exemple fictif » et porte "exemple_fictif": true.
8. L'objectif n'est pas de mémoriser mais de comprendre et de savoir réexpliquer simplement à voix haute.`;

const FORMAT = `Format de réponse attendu (important, la réponse sera importée telle quelle dans l'app) :
- Réponds par UN SEUL bloc de code \`\`\`json contenant un TABLEAU d'éléments, sans texte autour.
- Chaque élément garde exactement la même structure et les mêmes noms de champs que l'élément fourni.
- Pour corriger un élément existant : garde son "id" et son "type", augmente "version" de 1 et mets "maj" à la date du jour (AAAA-MM-JJ).
- Texte : mini-Markdown seulement (**gras**, *italique*, listes avec « - », paragraphes séparés par une ligne vide, donc \\n\\n dans le JSON).
- Dans le JSON, les barres obliques inverses du LaTeX sont doublées ("\\\\frac{a}{b}").

Champs communs à tous les types : id (ex. "m1.change.exportateur"), type, module (1 à 6), chapitre (ex. "m1.change"), difficulte (1 à 3), tags [], liens [ids], sources [{titre, url?, date?}], chiffres [{libelle, valeur, date, source}], maj, version.

Champs propres à chaque type :
- fiche : titre, une_phrase, trente_secondes, analogie, visuel?, exemple_chiffre [étapes], exemple_fictif (booléen), formules [{titre?, latex, legende {symbole LaTeX: sens}, en_francais}], deux_minutes, piege, a_dire_en_entretien.
  visuel est l'un de : {"type":"tableau","colonnes":[…],"lignes":[[…]],"legende"?} · {"type":"chaine","etapes":[{"titre","texte"}],"legende"?} · {"type":"barres","unite","barres":[{"libelle","valeur"}],"legende"?} · {"type":"outil","ref":"labo.…"} (ne change pas un visuel de type outil).
- carte : recto, verso, fiche? (id de la fiche liée).
- question_entretien : question, reponse_modele, points_cles [], piege, fiche?.
- quiz : forme ("qcm" | "vrai_faux" | "numerique" | "ordre"), enonce, explication, fiche?, puis selon la forme : choix [] + bonne (indice à partir de 0) · vrai (booléen) · reponse + tolerance + unite · etapes [] (dans le bon ordre).
- exercice : titre, enonce, etapes [{titre, texte, formule?, resultat?}], erreurs_a_eviter [], fiche?.
- cas_pratique : titre, situation, questions_a_poser [], proposition, scenario_defavorable, faisabilite, fiche?.
- lexique : terme, anglais?, definition, fiche?.`;

export function promptClarification(items: { clarif: Clarif; element: TElement | undefined }[]): string {
  const blocs = items.map(({ clarif, element }, i) => {
    const demande = [
      clarif.manques.length ? `Ce qui manque : ${clarif.manques.join(', ')}.` : '',
      clarif.phrase ? `Phrase exacte qui pose problème : « ${clarif.phrase} »` : '',
      clarif.commentaire ? `Mon commentaire : ${clarif.commentaire}` : '',
    ].filter(Boolean).join('\n');
    if (!element) {
      return `### Demande ${i + 1} — ajouter une notion\n${clarif.commentaire}\n\nCrée la ou les fiches nécessaires (type "fiche"), avec pour chacune 2 cartes, 1 question d'entretien, 2 questions de quiz et les entrées de lexique utiles. Choisis des identifiants nouveaux, cohérents avec ceux de l'app.`;
    }
    return `### Demande ${i + 1} — ${NOMS_TYPES[element.type]} « ${element.id} » (module ${element.module}, chapitre ${element.chapitre})\n${demande}\n\nContenu actuel complet :\n\`\`\`json\n${JSON.stringify(element, null, 2)}\n\`\`\``;
  });
  return `Je révise la culture des marchés financiers pour des entretiens de stage en finance de marché, avec une application dont le contenu est stocké en JSON. Certaines explications ne sont pas assez claires pour moi. Réécris-les en mieux.

${CONSIGNES}

${blocs.join('\n\n')}

${FORMAT}`;
}

export interface Lecture { elements: TElement[]; erreurs: string[] }

/** Lit la réponse de Claude : extrait le JSON, valide chaque élément et chaque formule. */
export function lireReponse(texte: string): Lecture {
  const erreurs: string[] = [];
  const bloc = texte.match(/```(?:json)?\s*([\s\S]*?)```/);
  let brut = (bloc ? bloc[1] : texte).trim();
  if (!bloc) {
    const debut = Math.min(...['[', '{'].map((c) => brut.indexOf(c)).filter((i) => i >= 0));
    const fin = Math.max(brut.lastIndexOf(']'), brut.lastIndexOf('}'));
    if (Number.isFinite(debut) && fin > debut) brut = brut.slice(debut, fin + 1);
  }
  let donnees: unknown;
  try {
    donnees = JSON.parse(brut);
  } catch (e) {
    return { elements: [], erreurs: [`Le texte collé n'est pas du JSON valide : ${(e as Error).message}`] };
  }
  const liste = Array.isArray(donnees) ? donnees : [donnees];
  const elements: TElement[] = [];
  liste.forEach((d, i) => {
    const res = Element.safeParse(d);
    const nom = (d as { id?: string })?.id ?? `élément ${i + 1}`;
    if (!res.success) {
      for (const p of res.error.issues.slice(0, 5)) erreurs.push(`${nom} : ${p.path.join('.') || 'structure'} → ${p.message}`);
      return;
    }
    const e = res.data;
    const formules = e.type === 'fiche' ? e.formules : e.type === 'exercice' ? e.etapes.flatMap((s) => (s.formule ? [s.formule] : [])) : [];
    for (const f of formules) {
      for (const tex of [f.latex, ...Object.keys(f.legende)]) {
        try {
          katex.renderToString(tex, { throwOnError: true });
        } catch (x) {
          erreurs.push(`${e.id} : formule illisible « ${tex} » (${(x as Error).message})`);
        }
      }
    }
    elements.push(e);
  });
  return { elements, erreurs };
}

/** Applique des éléments importés en conservant l'ancienne version dans l'historique. */
export async function appliquer(elements: TElement[], actuels: Map<string, TElement>): Promise<void> {
  await db.transaction('rw', db.overrides, db.clarifs, async () => {
    for (const e of elements) {
      const avant = await db.overrides.get(e.id);
      const precedent = actuels.get(e.id) ?? null;
      await db.overrides.put({
        id: e.id,
        element: e,
        historique: [...(avant?.historique ?? []), { element: precedent, date: Date.now() }],
        date: Date.now(),
      });
      await db.clarifs.where('elementId').equals(e.id).modify({ statut: 'traite' });
    }
  });
}

/** Retour arrière : restaure la version précédente (ou supprime l'import s'il n'y en avait pas). */
export async function annuler(id: string): Promise<void> {
  const o = await db.overrides.get(id);
  if (!o) return;
  const historique = [...o.historique];
  const precedent = historique.pop();
  const depot = ELEMENTS_DEPOT.get(id);
  const estDepot = precedent?.element && depot && JSON.stringify(precedent.element) === JSON.stringify(depot);
  if (!precedent?.element || estDepot) await db.overrides.delete(id);
  else await db.overrides.put({ ...o, element: precedent.element, historique, date: Date.now() });
}

export function clarifsEnMarkdown(items: { clarif: Clarif; element: TElement | undefined; titre: string }[]): string {
  const lignes = ['# À clarifier', ''];
  for (const { clarif, element, titre } of items) {
    lignes.push(`## ${element ? `${NOMS_TYPES[element.type]} — ${titre}` : 'Notion à ajouter'}`);
    if (element) lignes.push(`- Identifiant : \`${element.id}\``);
    lignes.push(`- Date : ${new Date(clarif.date).toLocaleDateString('fr-FR')}`);
    lignes.push(`- État : ${clarif.statut === 'traite' ? 'traité' : 'ouvert'}`);
    if (clarif.manques.length) lignes.push(`- Ce qui manque : ${clarif.manques.join(', ')}`);
    if (clarif.phrase) lignes.push(`- Phrase : « ${clarif.phrase} »`);
    if (clarif.commentaire) lignes.push(`- Commentaire : ${clarif.commentaire}`);
    lignes.push('');
  }
  return lignes.join('\n');
}

/** Export des contenus importés, regroupés par chapitre, au format attendu par « npm run integrer ». */
export async function exportContenusModifies(): Promise<string> {
  const overrides = await db.overrides.toArray();
  return JSON.stringify(
    { app: 'revision-marches', format: 'contenus-modifies', date: new Date().toISOString(), elements: overrides.map((o) => o.element) },
    null,
    2,
  );
}
