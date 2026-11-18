// Lance la collecte des chiffres de marché en local et affiche le résultat : npm run collecte
import { collecter } from '../netlify/lib/collecte';

const debut = Date.now();
const m = await collecter(null, undefined, process.env.FRED_API_KEY);
for (const s of Object.values(m.series)) {
  const v = s.texte ?? `${s.valeur.toFixed(s.decimales)}${s.unite === '%' ? ' %' : s.unite === 'pb' ? ' pb' : s.unite === '$' ? ' $' : ''}`;
  const p = s.precedent ? ` (précédent ${s.precedent.valeur.toFixed(s.decimales)} au ${s.precedent.date})` : '';
  console.log(`${s.cle.padEnd(22)} ${v.padEnd(18)} au ${s.date}${p}${s.note ? ' — ' + s.note : ''}`);
}
for (const [cle, msg] of Object.entries(m.details_erreurs ?? {})) console.log(`ERREUR ${cle} : ${msg}`);
console.log(`\n${Object.keys(m.series).length} séries, ${m.erreurs} erreur(s), ${((Date.now() - debut) / 1000).toFixed(1)} s`);
