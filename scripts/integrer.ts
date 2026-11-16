// Intègre au dépôt un fichier « contenus modifiés » exporté depuis l'app :
//   npm run integrer -- chemin/vers/contenus-modifies.json
// Chaque élément remplace celui de même identifiant dans le fichier de son chapitre, ou y est ajouté.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Element } from '../src/schema';

const chemin = process.argv[2];
if (!chemin) {
  console.error('Usage : npm run integrer -- fichier.json');
  process.exit(1);
}
const brut = JSON.parse(readFileSync(chemin, 'utf8'));
const elements = (brut.elements ?? brut) as unknown[];

const fichiers = new Map<string, { chemin: string; json: { chapitre: { id: string }; elements: { id: string }[] } }>();
for (const dossier of readdirSync('content').filter((d) => d.startsWith('module-'))) {
  for (const f of readdirSync(join('content', dossier)).filter((x) => x.endsWith('.json'))) {
    const c = join('content', dossier, f);
    const json = JSON.parse(readFileSync(c, 'utf8'));
    fichiers.set(json.chapitre.id, { chemin: c, json });
  }
}

let remplaces = 0, ajoutes = 0;
for (const e of elements) {
  const el = Element.parse(e);
  const cible = fichiers.get(el.chapitre);
  if (!cible) {
    console.error(`✗ ${el.id} : chapitre « ${el.chapitre} » introuvable dans content/. Crée d'abord le fichier du chapitre.`);
    process.exitCode = 1;
    continue;
  }
  const i = cible.json.elements.findIndex((x) => x.id === el.id);
  if (i >= 0) { cible.json.elements[i] = e as { id: string }; remplaces++; }
  else { cible.json.elements.push(e as { id: string }); ajoutes++; }
}
for (const { chemin: c, json } of fichiers.values()) writeFileSync(c, JSON.stringify(json, null, 2) + '\n');
console.log(`${remplaces} élément(s) remplacé(s), ${ajoutes} ajouté(s). Lance « npm run validate » puis « git commit ».`);
