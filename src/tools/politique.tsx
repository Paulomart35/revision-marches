// Outils du module 1, partie politique monétaire : chaîne de transmission, « Toi, gouverneur », graphique historique.
import { useEffect, useState } from 'react';
import { nf } from '../lib';

/* ---------- Chaîne de transmission animée (hausse et baisse) ---------- */
const CHAINES = {
  hausse: {
    titre: 'La BCE monte ses taux',
    etapes: [
      ['La BCE monte ses taux directeurs', 'Le taux de dépôt augmente, en général de 0,25 point.'],
      ['Les taux de marché montent', 'L\'€STR et l\'Euribor suivent tout de suite ; les banques paient plus cher pour se financer.'],
      ['Le crédit coûte plus cher, l\'épargne rapporte plus', 'Les banques répercutent la hausse sur les prêts et, plus lentement, sur les dépôts.'],
      ['Ménages et entreprises dépensent moins', 'Des achats immobiliers et des investissements sont reportés ou abandonnés.'],
      ['La demande ralentit', 'Les carnets de commandes se dégarnissent, le marché du travail se détend.'],
      ['L\'inflation ralentit', 'Les entreprises augmentent moins leurs prix et les salaires. Effet complet : 12 à 24 mois.'],
    ],
    change: 'En parallèle, l\'euro tend à s\'apprécier : les importations, dont l\'énergie, coûtent moins cher.',
  },
  baisse: {
    titre: 'La BCE baisse ses taux',
    etapes: [
      ['La BCE baisse ses taux directeurs', 'Le taux de dépôt diminue, en général de 0,25 point.'],
      ['Les taux de marché baissent', 'L\'€STR et l\'Euribor suivent tout de suite ; les banques se financent moins cher.'],
      ['Le crédit coûte moins cher, l\'épargne rapporte moins', 'Emprunter devient plus intéressant que laisser son argent dormir.'],
      ['Ménages et entreprises dépensent plus', 'Les projets immobiliers et les investissements repartent.'],
      ['La demande accélère', 'Les entreprises produisent et embauchent davantage.'],
      ['L\'inflation remonte vers la cible', 'Utile quand elle était trop basse. Effet complet : 12 à 24 mois.'],
    ],
    change: 'En parallèle, l\'euro tend à se déprécier : les exportateurs sont avantagés, les importations coûtent plus cher.',
  },
};

export function Transmission() {
  const [sens, setSens] = useState<'hausse' | 'baisse'>('hausse');
  const [actif, setActif] = useState(-1);
  const [lecture, setLecture] = useState(false);
  const c = CHAINES[sens];
  useEffect(() => {
    if (!lecture) return;
    if (actif >= c.etapes.length - 1) { setLecture(false); return; }
    const t = setTimeout(() => setActif((a) => a + 1), actif < 0 ? 100 : 1400);
    return () => clearTimeout(t);
  }, [lecture, actif, c.etapes.length]);
  const choisir = (s: 'hausse' | 'baisse') => { setSens(s); setActif(-1); setLecture(false); };
  return (
    <div className="outil">
      <div className="seg" role="group" aria-label="Sens de la décision">
        <button aria-pressed={sens === 'hausse'} onClick={() => choisir('hausse')}>Hausse de taux</button>
        <button aria-pressed={sens === 'baisse'} onClick={() => choisir('baisse')}>Baisse de taux</button>
      </div>
      <ol className="chaine">
        {c.etapes.map(([titre, texte], i) => (
          <li key={titre} className={i <= actif ? 'on' : ''} onClick={() => { setLecture(false); setActif(i); }}>
            <b>{titre}</b><span>{texte}</span>
          </li>
        ))}
      </ol>
      <div className="ligne">
        <button className="btn y" onClick={() => { setActif(-1); setLecture(true); }}>▶ Lancer l'animation</button>
        <button className="btn g" onClick={() => { setLecture(false); setActif(Math.min(actif + 1, c.etapes.length - 1)); }}>Étape suivante</button>
      </div>
      <p className="verdict">{actif >= c.etapes.length - 1 ? c.change : 'Essaie de dire chaque étape à voix haute avant de la dévoiler.'}</p>
    </div>
  );
}

/* ---------- « Toi, gouverneur de la BCE » ---------- */
type Origine = 'energie' | 'demande';
interface Verdict { classe: 'up' | 'down' | 'hold'; decision: string; pourquoi: string }

/** Règle pédagogique simplifiée : ce n'est pas une prévision, c'est le raisonnement type d'une banque centrale. */
export function decisionGouverneur(inflation: number, croissance: number, origine: Origine): Verdict {
  if (inflation <= 0.5 && croissance < 0.5)
    return { classe: 'down', decision: 'Baisser fortement les taux, et envisager des achats d\'obligations', pourquoi: 'Risque de déflation et économie à l\'arrêt : il faut relancer le crédit et la demande. Si les taux sont déjà au plancher, il reste le bilan (QE). C\'est la situation de la BCE entre 2014 et 2021.' };
  if (inflation < 1.5)
    return { classe: 'down', decision: 'Baisser les taux', pourquoi: 'L\'inflation est sous la cible de 2 %, et la cible est symétrique : trop bas est aussi un problème que trop haut. Des taux plus bas soutiennent la demande et ramènent l\'inflation vers 2 %.' };
  if (inflation <= 2.5) {
    if (croissance < 0) return { classe: 'down', decision: 'Baisser les taux', pourquoi: 'L\'inflation est proche de la cible et l\'économie recule : la banque centrale a de la marge pour soutenir l\'activité sans menacer la stabilité des prix.' };
    if (croissance > 2.5 && inflation > 2.2) return { classe: 'hold', decision: 'Maintenir, avec un ton ferme', pourquoi: 'L\'inflation est proche de la cible, mais l\'économie tourne vite et elle dérive vers le haut : la banque centrale prévient qu\'elle est prête à monter si la surchauffe se confirme.' };
    return { classe: 'hold', decision: 'Maintenir les taux', pourquoi: 'L\'inflation est proche de 2 % et l\'économie est sur son rythme normal. Il n\'y a rien à corriger : la banque centrale attend les prochaines données.' };
  }
  if (inflation <= 4) {
    if (origine === 'demande') return { classe: 'up', decision: 'Monter les taux', pourquoi: 'L\'inflation dépasse la cible parce que la demande est trop forte. Pas de dilemme : monter les taux freine le crédit et la demande, donc les prix.' };
    if (croissance < 0.5) return { classe: 'hold', decision: 'Maintenir, en surveillant de près', pourquoi: 'L\'inflation vient de l\'énergie et l\'économie est à l\'arrêt. Monter les taux n\'agirait pas sur la cause et aggraverait le ralentissement. La banque centrale « regarde au travers » du choc, tant que les salaires et les anticipations restent sages.' };
    return { classe: 'up', decision: 'Monter prudemment, par pas de 0,25 point', pourquoi: 'L\'inflation vient de l\'énergie, mais l\'économie tient encore : le risque est que la hausse se propage aux salaires et aux autres prix (effets de second tour). La banque centrale agit pour garder les anticipations ancrées. C\'est le choix de la BCE en 2026.' };
  }
  if (origine === 'demande') return { classe: 'up', decision: 'Monter fortement les taux', pourquoi: 'Inflation très au-dessus de la cible et tirée par la demande : la banque centrale a pris du retard et doit frapper fort, par pas de 0,50 point ou plus.' };
  if (croissance < 0) return { classe: 'up', decision: 'Monter les taux, malgré la récession', pourquoi: 'C\'est la stagflation, le pire cas. À ce niveau d\'inflation, le risque de désancrage des anticipations l\'emporte : la banque centrale donne la priorité aux prix, en sachant qu\'elle aggrave le ralentissement. C\'est la leçon des années 1970.' };
  return { classe: 'up', decision: 'Monter fortement les taux', pourquoi: 'Même si l\'origine est l\'énergie, une inflation aussi élevée finit par passer dans tous les prix et dans les salaires. La banque centrale monte vite pour casser les effets de second tour. C\'est ce qu\'a fait la BCE en 2022-2023.' };
}

const SCENARIOS: { nom: string; inflation: number; croissance: number; origine: Origine; reel: string }[] = [
  { nom: 'Novembre 2026', inflation: 4.0, croissance: 1.3, origine: 'energie', reel: 'Ce que la BCE a fait : deux hausses de 0,25 point (juin et septembre 2026), puis une pause à 2,50 % le 29 octobre.' },
  { nom: 'Octobre 2022', inflation: 10.6, croissance: 2.5, origine: 'energie', reel: 'Ce que la BCE a fait : dix hausses de suite, de −0,50 % en juillet 2022 à 4,00 % en septembre 2023.' },
  { nom: '2020 (Covid)', inflation: 0.3, croissance: -6, origine: 'demande', reel: 'Ce que la BCE a fait : taux maintenu à −0,50 % et programme d\'achats d\'urgence (PEPP) de 1 850 milliards d\'euros.' },
  { nom: 'Mi-2025', inflation: 2.0, croissance: 1.3, origine: 'demande', reel: 'Ce que la BCE a fait : après huit baisses, elle s\'est arrêtée à 2,00 % en juin 2025 et a maintenu ses taux.' },
];

export function Gouverneur() {
  const [inflation, setInflation] = useState(4);
  const [croissance, setCroissance] = useState(1.3);
  const [origine, setOrigine] = useState<Origine>('energie');
  const [reel, setReel] = useState<string | null>(SCENARIOS[0].reel);
  const v = decisionGouverneur(inflation, croissance, origine);
  const regler = (f: () => void) => { f(); setReel(null); };
  return (
    <div className="outil">
      <div className="seg" role="group" aria-label="Scénarios">
        {SCENARIOS.map((s) => (
          <button key={s.nom} aria-pressed={reel === s.reel} onClick={() => { setInflation(s.inflation); setCroissance(s.croissance); setOrigine(s.origine); setReel(s.reel); }}>{s.nom}</button>
        ))}
      </div>
      <label className="curseur">
        <span>Inflation sur un an<output>{nf(inflation, 1)} %</output></span>
        <input type="range" min={-1} max={11} step={0.1} value={inflation} onChange={(e) => regler(() => setInflation(Number(e.target.value)))} />
      </label>
      <label className="curseur">
        <span>Croissance du PIB sur un an<output>{croissance > 0 ? '+' : ''}{nf(croissance, 1)} %</output></span>
        <input type="range" min={-7} max={6} step={0.1} value={croissance} onChange={(e) => regler(() => setCroissance(Number(e.target.value)))} />
      </label>
      <div>
        <small className="note">Origine de l'inflation</small>
        <div className="seg" role="group" aria-label="Origine de l'inflation">
          <button aria-pressed={origine === 'energie'} onClick={() => regler(() => setOrigine('energie'))}>Choc d'énergie (coûts)</button>
          <button aria-pressed={origine === 'demande'} onClick={() => regler(() => setOrigine('demande'))}>Demande trop forte</button>
        </div>
      </div>
      <div className={`decision ${v.classe}`}>
        <small>La décision type</small>
        <b>{v.decision}</b>
        <p>{v.pourquoi}</p>
        {reel && <p className="reel">{reel}</p>}
      </div>
      <p className="note">Règle pédagogique simplifiée, pas une prévision. Scénarios : ordres de grandeur de l'inflation et de la croissance de la zone euro (Eurostat). Entraîne-toi à redire la justification avec tes mots.</p>
    </div>
  );
}

/* ---------- Inflation et taux de dépôt de la BCE depuis 2014 ---------- */
// Taux de dépôt : dates d'entrée en vigueur (source : BCE, historique des taux directeurs).
const DEPOT: [string, number][] = [
  ['2014-01-01', 0], ['2014-06-11', -0.1], ['2014-09-10', -0.2], ['2015-12-09', -0.3], ['2016-03-16', -0.4], ['2019-09-18', -0.5],
  ['2022-07-27', 0], ['2022-09-14', 0.75], ['2022-11-02', 1.5], ['2022-12-21', 2], ['2023-02-08', 2.5], ['2023-03-22', 3], ['2023-05-10', 3.25],
  ['2023-06-21', 3.5], ['2023-08-02', 3.75], ['2023-09-20', 4], ['2024-06-12', 3.75], ['2024-09-18', 3.5], ['2024-10-23', 3.25], ['2024-12-18', 3],
  ['2025-02-05', 2.75], ['2025-03-12', 2.5], ['2025-04-23', 2.25], ['2025-06-11', 2], ['2026-06-17', 2.25], ['2026-09-16', 2.5],
];
// Inflation zone euro (IPCH) : moyennes annuelles placées au milieu de l'année, plus le pic d'octobre 2022
// et les deux derniers chiffres mensuels de 2026 (source : Eurostat).
const INFLATION: [number, number][] = [
  [2014.5, 0.4], [2015.5, 0.2], [2016.5, 0.2], [2017.5, 1.5], [2018.5, 1.8], [2019.5, 1.2], [2020.5, 0.3], [2021.5, 2.6],
  [2022.5, 8.4], [2022.79, 10.6], [2023.5, 5.4], [2024.5, 2.4], [2025.5, 2.1], [2026.71, 3.8], [2026.79, 4.0],
];
const PHASES = [
  { nom: '2014-2021', de: 2014, a: 2021.5, titre: 'Taux négatifs', texte: 'L\'inflation est durablement sous 2 % et la croissance est molle. La BCE descend son taux de dépôt sous zéro, jusqu\'à −0,50 %, et achète massivement des obligations (QE) pour relancer le crédit.' },
  { nom: '2022-2023', de: 2021.5, a: 2023.75, titre: 'La hausse record', texte: 'Sortie du Covid puis guerre en Ukraine : l\'inflation atteint 10,6 % en octobre 2022. La BCE monte son taux de −0,50 % à 4,00 % en quatorze mois, du jamais vu.' },
  { nom: '2024-2025', de: 2023.75, a: 2025.9, titre: 'Les huit baisses', texte: 'L\'inflation revient vers 2 % et la croissance est faible. La BCE redescend de 4,00 % à 2,00 % entre juin 2024 et juin 2025, puis s\'arrête.' },
  { nom: '2026', de: 2025.9, a: 2026.95, titre: 'Le retour des hausses', texte: 'Un choc d\'énergie lié au conflit au Moyen-Orient fait remonter l\'inflation à 4,0 % en octobre 2026. La BCE remonte à 2,25 % en juin puis 2,50 % en septembre, et fait une pause fin octobre.' },
];
const annee = (iso: string) => { const d = new Date(iso + 'T12:00:00'); return d.getFullYear() + (d.getMonth() + d.getDate() / 31) / 12; };

export function Historique() {
  const [phase, setPhase] = useState(3);
  const L = 340, H = 220, x0 = 30, y0 = 10, w = L - x0 - 8, h = H - y0 - 24;
  const X = (a: number) => x0 + ((a - 2014) / (2026.95 - 2014)) * w;
  const Y = (v: number) => y0 + (1 - (v + 1) / 12) * h;
  let dep = '';
  DEPOT.forEach(([d, v], i) => { const x = X(annee(d)).toFixed(1); dep += i === 0 ? `M${x},${Y(v).toFixed(1)}` : ` H${x} V${Y(v).toFixed(1)}`; });
  dep += ` H${X(2026.88).toFixed(1)}`;
  const inf = INFLATION.map(([a, v], i) => `${i ? 'L' : 'M'}${X(a).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const p = PHASES[phase];
  return (
    <div className="outil">
      <svg viewBox={`0 0 ${L} ${H}`} role="img" aria-label="Inflation de la zone euro et taux de dépôt de la BCE de 2014 à 2026">
        <rect x={X(p.de)} y={y0} width={X(p.a) - X(p.de)} height={h} className="bande" />
        {[0, 2, 4, 6, 8, 10].map((v) => (
          <g key={v}><line x1={x0} x2={x0 + w} y1={Y(v)} y2={Y(v)} className={v === 2 ? 'cible' : 'axe'} /><text x={x0 - 4} y={Y(v) + 3} className="petit" textAnchor="end">{v} %</text></g>
        ))}
        <text x={x0 + 4} y={Y(2) - 4} className="petit cibletxt">cible 2 %</text>
        {[2014, 2016, 2018, 2020, 2022, 2024, 2026].map((a) => <text key={a} x={X(a)} y={H - 6} className="petit" textAnchor="middle">{a}</text>)}
        <path d={inf} className="courbe c1" />
        <path d={dep} className="courbe" />
        {INFLATION.filter(([a]) => a === 2022.79 || a === 2026.79).map(([a, v]) => <circle key={a} cx={X(a)} cy={Y(v)} r={3.5} className="pt1" />)}
      </svg>
      <div className="duo">
        <div><small><i className="trait c1" /> Inflation de la zone euro</small><b>4,0 %</b><em>octobre 2026</em></div>
        <div><small><i className="trait" /> Taux de dépôt de la BCE</small><b>2,50 %</b><em>depuis le 16 septembre 2026</em></div>
      </div>
      <div className="seg" role="group" aria-label="Périodes">
        {PHASES.map((x, i) => <button key={x.nom} aria-pressed={phase === i} onClick={() => setPhase(i)}>{x.nom}</button>)}
      </div>
      <p className="verdict"><b>{p.titre}.</b> {p.texte}</p>
      <p className="note">Inflation (IPCH, Eurostat) : moyennes annuelles jusqu'en 2025, pic d'octobre 2022, puis septembre et octobre 2026. Taux de dépôt (BCE) : dates d'entrée en vigueur. Données arrêtées au 16 novembre 2026.</p>
    </div>
  );
}
