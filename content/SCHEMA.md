# Schéma du contenu

La définition qui fait foi est `src/schema.ts`. `npm run validate` vérifie tout le contenu avant chaque build.

## Fichier de chapitre

`content/module-N/NN-nom.json` :

```json
{ "chapitre": { "id": "m1.change", "module": 1, "ordre": 1, "titre": "…", "resume": "…" }, "elements": [ … ] }
```

L'identifiant de chaque élément commence par celui de son chapitre : `m1.change.exportateur`.

## Champs communs à tous les éléments

| Champ | Rôle |
|---|---|
| `id` | Identifiant stable, en minuscules, séparé par des points |
| `type` | `fiche`, `carte`, `question_entretien`, `quiz`, `exercice`, `cas_pratique`, `lexique` |
| `module`, `chapitre` | Rattachement |
| `difficulte` | 1 (facile) à 3 (difficile) |
| `tags`, `liens` | Mots-clés ; identifiants des notions liées |
| `sources` | `[{ titre, url?, date? }]` |
| `chiffres` | Chiffres de marché réels : `[{ libelle, valeur, date, source, url? }]`, toujours datés et sourcés |
| `maj`, `version` | Date `AAAA-MM-JJ` et numéro de version |

## Champs propres à chaque type

- **fiche** : `titre`, `une_phrase`, `trente_secondes`, `analogie`, `visuel?`, `exemple_chiffre[]`, `exemple_fictif` (vrai par défaut), `formules[]`, `deux_minutes`, `piege`, `a_dire_en_entretien`.
- **carte** : `recto`, `verso`, `fiche?`.
- **question_entretien** : `question`, `reponse_modele`, `points_cles[]`, `piege`, `fiche?`.
- **quiz** : `forme`, `enonce`, `explication`, `fiche?`, puis selon la forme :
  - `qcm` : `choix[]`, `bonne` (indice à partir de 0) ;
  - `vrai_faux` : `vrai` ;
  - `numerique` : `reponse`, `tolerance`, `unite` ;
  - `ordre` : `etapes[]`, dans le bon ordre (l'app les mélange).
- **exercice** : `titre`, `enonce`, `etapes[]` (`titre`, `texte`, `formule?`, `resultat?`, `verif?`), `erreurs_a_eviter[]`, `fiche?`.
- **cas_pratique** : `titre`, `situation`, `questions_a_poser[]`, `proposition`, `scenario_defavorable`, `faisabilite`, `fiche?`.
- **lexique** : `terme`, `anglais?`, `definition`, `fiche?`.

## Pack actu mensuel

`content/actu/AAAA-MM.json`, un fichier par mois. Le plus récent alimente l'onglet Marché ; les autres restent en archive.

| Champ | Rôle |
|---|---|
| `id`, `mois`, `arrete_le`, `titre` | `actu.2026-11`, `2026-11`, date de la photo, « Novembre 2026 » |
| `histoire` | Exactement 5 phrases |
| `vue_30s` | Le paragraphe à dire à voix haute |
| `chiffres[]` | `cle`, `groupe`, `libelle`, `valeur`, `date`, `source`, `url?`, `tendance` (`hausse`, `baisse`, `stable`), `tendance_texte`, `definition`, `pourquoi` |
| `evenements[]` | `date`, `titre`, `texte` |
| `calendrier[]` | `date` (texte libre), `evenement`, `pourquoi` |
| `impacts[]` | `client`, `texte` |
| `sources[]` | `titre`, `url?`, `date?` |
| `elements[]` | Questions d'entretien et quiz d'actualité, d'identifiant `m1.marche.…` |

Groupes possibles : Banques centrales, Taux courts, Inflation, Change, Taux longs, Matières premières et actions.

Depuis l'app, l'onglet Marché permet de copier la demande à coller dans Claude, d'importer sa réponse, puis d'exporter le pack au format du dépôt.

## Règles

- **Formules** : jamais dans le texte. Uniquement `{ titre?, latex, legende: { "symbole LaTeX": "sens" }, en_francais }`.
- **Visuel** d'une fiche : `outil` (`ref` vers un outil du Labo), `tableau` (`colonnes`, `lignes`), `chaine` (`etapes` animées), `barres` (`unite`, `barres`).
- **Texte** : mini-Markdown (`**gras**`, `*italique*`, listes `- `, paragraphes séparés par une ligne vide, lien `[[id|texte]]`).
- **Exemple réel** (`exemple_fictif: false`) : `chiffres` et `sources` obligatoires.
- **`verif`** d'une étape d'exercice : `{ fn, args, attendu, tolerance }`. Le script recalcule le résultat avec la fonction `fn` de `src/finance/registre.ts`.
