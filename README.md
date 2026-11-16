# Révision marchés

Application web (PWA) pour comprendre la culture des marchés financiers et s'entraîner aux questions d'entretien. Elle s'installe sur l'écran d'accueil du téléphone et fonctionne hors ligne.

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | Lance l'app en local |
| `npm run validate` | Vérifie le contenu : schéma, liens, formules, chiffres datés et sourcés, exercices recalculés |
| `npm run test` | Tests des calculs financiers et de la répétition espacée |
| `npm run build` | Validation + vérification des types + build dans `dist/` |
| `npm run integrer -- fichier.json` | Intègre au dépôt un export « contenus modifiés » fait depuis l'app |

## Organisation

- `content/` : tout le contenu, un fichier JSON par chapitre. Le schéma est décrit dans `content/SCHEMA.md` et défini dans `src/schema.ts`.
- `src/finance/` : calculs financiers, testés. Les outils du Labo et la vérification des exercices utilisent les mêmes fonctions.
- `src/tools/` : outils interactifs du Labo.
- `src/components/Elements.tsx` : affichage d'une fiche, carte, question, quiz, exercice, cas pratique.
- `src/clarifier.ts` : bouton « Pas clair ? », prompt pour Claude, import de la réponse.
- `sources/` : fichiers HTML de départ. Ce dossier est exclu de git (il contient des éléments personnels).

## Déploiement

Netlify reconstruit et publie le site à chaque `git push` sur `main` (commande `npm run test && npm run build`, dossier `dist`, voir `netlify.toml`).

## Installer l'app sur le téléphone

- **iPhone (Safari)** : ouvrir le site, bouton Partager, « Sur l'écran d'accueil ».
- **Android (Chrome)** : ouvrir le site, menu ⋮, « Installer l'application » ou « Ajouter à l'écran d'accueil ».

Les données (progression, listes, contenus importés) restent sur l'appareil. Réglages → « Sauvegarder » permet de les exporter.
