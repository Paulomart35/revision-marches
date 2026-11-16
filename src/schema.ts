// Schéma de données de l'app. Utilisé par le script de validation, par l'app et par l'import « Pas clair ? ».
// La documentation lisible est dans content/SCHEMA.md.
import { z } from 'zod';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date au format AAAA-MM-JJ');
const id = z.string().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/, 'identifiant du type m1.change.exportateur');

/** Un chiffre de marché : toujours daté et sourcé. */
export const Chiffre = z.object({
  libelle: z.string().min(1),
  valeur: z.string().min(1),
  date,
  source: z.string().min(1),
  url: z.string().url().optional(),
});

export const Source = z.object({ titre: z.string().min(1), url: z.string().url().optional(), date: date.optional() });

const base = {
  id,
  module: z.number().int().min(1).max(6),
  chapitre: z.string().min(1),
  difficulte: z.number().int().min(1).max(3),
  tags: z.array(z.string()).default([]),
  liens: z.array(z.string()).default([]),
  sources: z.array(Source).default([]),
  chiffres: z.array(Chiffre).default([]),
  maj: date,
  version: z.number().int().min(1),
};

export const Formule = z.object({
  titre: z.string().optional(),
  latex: z.string().min(1),
  legende: z.record(z.string(), z.string()),
  en_francais: z.string().min(1),
});

export const Visuel = z.discriminatedUnion('type', [
  z.object({ type: z.literal('outil'), ref: z.string(), legende: z.string().optional() }),
  z.object({ type: z.literal('tableau'), colonnes: z.array(z.string()).min(2), lignes: z.array(z.array(z.string())).min(1), legende: z.string().optional() }),
  z.object({ type: z.literal('chaine'), etapes: z.array(z.object({ titre: z.string(), texte: z.string() })).min(2), legende: z.string().optional() }),
  z.object({ type: z.literal('barres'), unite: z.string(), barres: z.array(z.object({ libelle: z.string(), valeur: z.number() })).min(2), legende: z.string().optional() }),
]);

export const Fiche = z.object({
  ...base,
  type: z.literal('fiche'),
  titre: z.string().min(1),
  une_phrase: z.string().min(1),
  trente_secondes: z.string().min(1),
  analogie: z.string().min(1),
  visuel: Visuel.optional(),
  exemple_chiffre: z.array(z.string()).min(1),
  exemple_fictif: z.boolean().default(true),
  formules: z.array(Formule).default([]),
  deux_minutes: z.string().min(1),
  piege: z.string().min(1),
  a_dire_en_entretien: z.string().min(1),
});

export const Carte = z.object({
  ...base,
  type: z.literal('carte'),
  recto: z.string().min(1),
  verso: z.string().min(1),
  fiche: z.string().optional(),
});

export const QuestionEntretien = z.object({
  ...base,
  type: z.literal('question_entretien'),
  question: z.string().min(1),
  reponse_modele: z.string().min(1),
  points_cles: z.array(z.string()).min(1),
  piege: z.string().min(1),
  fiche: z.string().optional(),
});

const quizBase = { ...base, type: z.literal('quiz'), enonce: z.string().min(1), explication: z.string().min(1), fiche: z.string().optional() };
export const Quiz = z.discriminatedUnion('forme', [
  z.object({ ...quizBase, forme: z.literal('qcm'), choix: z.array(z.string()).min(2), bonne: z.number().int().min(0) }),
  z.object({ ...quizBase, forme: z.literal('vrai_faux'), vrai: z.boolean() }),
  z.object({ ...quizBase, forme: z.literal('numerique'), reponse: z.number(), tolerance: z.number().min(0), unite: z.string().default('') }),
  z.object({ ...quizBase, forme: z.literal('ordre'), etapes: z.array(z.string()).min(3) }),
]);

/** Recalcul d'un résultat par une fonction de src/finance (voir src/finance/registre.ts). */
export const Verif = z.object({ fn: z.string(), args: z.array(z.number()), attendu: z.number(), tolerance: z.number().min(0) });

export const Exercice = z.object({
  ...base,
  type: z.literal('exercice'),
  titre: z.string().min(1),
  enonce: z.string().min(1),
  etapes: z.array(z.object({
    titre: z.string().min(1),
    texte: z.string().min(1),
    formule: Formule.optional(),
    resultat: z.string().optional(),
    verif: Verif.optional(),
  })).min(1),
  erreurs_a_eviter: z.array(z.string()).min(1),
  fiche: z.string().optional(),
});

export const CasPratique = z.object({
  ...base,
  type: z.literal('cas_pratique'),
  titre: z.string().min(1),
  situation: z.string().min(1),
  questions_a_poser: z.array(z.string()).min(1),
  proposition: z.string().min(1),
  scenario_defavorable: z.string().min(1),
  faisabilite: z.string().min(1),
  fiche: z.string().optional(),
});

export const Lexique = z.object({
  ...base,
  type: z.literal('lexique'),
  terme: z.string().min(1),
  anglais: z.string().optional(),
  definition: z.string().min(1),
  fiche: z.string().optional(),
});

export const Element = z.union([Fiche, Carte, QuestionEntretien, Quiz, Exercice, CasPratique, Lexique]);

export const Chapitre = z.object({
  id: z.string().min(1),
  module: z.number().int(),
  ordre: z.number().int(),
  titre: z.string().min(1),
  resume: z.string().min(1),
});

export const FichierChapitre = z.object({ chapitre: Chapitre, elements: z.array(Element) });

export const Module = z.object({ id: z.number().int(), titre: z.string(), court: z.string(), disponible: z.boolean() });

export type TChiffre = z.infer<typeof Chiffre>;
export type TFormule = z.infer<typeof Formule>;
export type TVisuel = z.infer<typeof Visuel>;
export type TFiche = z.infer<typeof Fiche>;
export type TCarte = z.infer<typeof Carte>;
export type TQuestion = z.infer<typeof QuestionEntretien>;
export type TQuiz = z.infer<typeof Quiz>;
export type TExercice = z.infer<typeof Exercice>;
export type TCas = z.infer<typeof CasPratique>;
export type TLexique = z.infer<typeof Lexique>;
export type TElement = z.infer<typeof Element>;
export type TChapitre = z.infer<typeof Chapitre>;
export type TModule = z.infer<typeof Module>;

export const NOMS_TYPES: Record<TElement['type'], string> = {
  fiche: 'Fiche',
  carte: 'Carte',
  question_entretien: 'Question d\'entretien',
  quiz: 'Quiz',
  exercice: 'Exercice',
  cas_pratique: 'Cas pratique',
  lexique: 'Lexique',
};

/** Titre lisible d'un élément, quel que soit son type. */
export function titreDe(e: TElement): string {
  switch (e.type) {
    case 'fiche': case 'exercice': case 'cas_pratique': return e.titre;
    case 'carte': return e.recto;
    case 'question_entretien': return e.question;
    case 'quiz': return e.enonce;
    case 'lexique': return e.terme;
  }
}
