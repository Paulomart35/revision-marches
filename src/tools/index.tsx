// Outils interactifs du Labo. Chaque outil est aussi intégré dans les fiches qui le référencent.
import { useState, type ReactNode } from 'react';
import { usdVersEur } from '../finance/fx';
import { contribution, inflationPonderee, niveauPrix, pouvoirAchat } from '../finance/inflation';
import { eur, nf } from '../lib';
import { Gouverneur, Historique, Transmission } from './politique';
import { CoursTerme, CouverturesFx } from './change';
import { Autocall, CapitalGaranti } from './structures';
import { Courbe, Emprunteur, Obligation, SwapFlux } from './taux';
import { ArbreBinomial, CouvertureDelta, Explorateur, GrecquesProfils, MonteCarlo, Smile, Strategies } from './options';

function Curseur(p: { libelle: string; valeur: number; min: number; max: number; pas: number; affiche: string; onChange: (v: number) => void }) {
  return (
    <label className="curseur">
      <span>{p.libelle}<output>{p.affiche}</output></span>
      <input type="range" min={p.min} max={p.max} step={p.pas} value={p.valeur} onChange={(e) => p.onChange(Number(e.target.value))} />
    </label>
  );
}

/* ---------- Calculateur exportateur / importateur ---------- */
function FxCalculateur() {
  const [cours, setCours] = useState(1.1);
  const [montant, setMontant] = useState(1_000_000);
  const REF = 1.1;
  const valeur = usdVersEur(montant, cours);
  const ecart = valeur - usdVersEur(montant, REF);
  const L = 320, H = 150, x0 = 38, y0 = 14, w = L - x0 - 10, h = H - y0 - 26;
  const cMin = 0.95, cMax = 1.3;
  const vMax = usdVersEur(montant, cMin), vMin = usdVersEur(montant, cMax);
  const X = (c: number) => x0 + ((c - cMin) / (cMax - cMin)) * w;
  const Y = (v: number) => y0 + (1 - (v - vMin) / (vMax - vMin)) * h;
  const pts = Array.from({ length: 36 }, (_, i) => cMin + (i / 35) * (cMax - cMin));
  const chemin = pts.map((c, i) => `${i ? 'L' : 'M'}${X(c).toFixed(1)},${Y(usdVersEur(montant, c)).toFixed(1)}`).join(' ');
  const sens = Math.abs(cours - REF) < 0.005 ? null : cours < REF ? 'bas' : 'haut';
  return (
    <div className="outil">
      <div className="seg" role="group" aria-label="Montant">
        {[500_000, 1_000_000, 2_000_000].map((m) => (
          <button key={m} aria-pressed={montant === m} onClick={() => setMontant(m)}>{nf(m / 1e6, m < 1e6 ? 1 : 0)} M$</button>
        ))}
      </div>
      <Curseur libelle="Cours EUR/USD (dollars pour 1 euro)" valeur={cours} min={cMin} max={cMax} pas={0.01} affiche={nf(cours, 2)} onChange={setCours} />
      <div className="echelle"><span>← euro faible, dollar fort</span><span>euro fort, dollar faible →</span></div>
      <svg viewBox={`0 0 ${L} ${H}`} role="img" aria-label="Valeur en euros du montant en dollars selon le cours">
        <line x1={x0} y1={y0 + h} x2={x0 + w} y2={y0 + h} className="axe" />
        <line x1={X(REF)} y1={y0} x2={X(REF)} y2={y0 + h} className="repere" />
        <text x={X(REF)} y={H - 4} className="petit" textAnchor="middle">1,10 (référence)</text>
        <text x={x0} y={H - 4} className="petit" textAnchor="middle">0,95</text>
        <text x={x0 + w} y={H - 4} className="petit" textAnchor="end">1,30</text>
        <text x={4} y={y0 + 8} className="petit">€</text>
        <path d={chemin} className="courbe" />
        <circle cx={X(cours)} cy={Y(valeur)} r={7} className="point" />
      </svg>
      <div className="duo">
        <div className={sens === 'bas' ? 'bien' : sens === 'haut' ? 'mal' : ''}>
          <small>Exportateur : il reçoit {nf(montant / 1e6, montant < 1e6 ? 1 : 0)} M$ et les vend</small>
          <b>{eur(valeur)}</b>
          <em>{sens ? `${ecart > 0 ? '+' : '−'} ${eur(Math.abs(ecart))} par rapport à 1,10` : 'Cours de référence'}</em>
        </div>
        <div className={sens === 'haut' ? 'bien' : sens === 'bas' ? 'mal' : ''}>
          <small>Importateur : il doit acheter {nf(montant / 1e6, montant < 1e6 ? 1 : 0)} M$</small>
          <b>{eur(valeur)}</b>
          <em>{sens ? `${ecart > 0 ? 'surcoût de' : 'économie de'} ${eur(Math.abs(ecart))}` : 'Cours de référence'}</em>
        </div>
      </div>
      <p className="verdict">
        {sens === 'bas' && <>EUR/USD <b>bas</b> : le dollar est fort. L'<b>exportateur</b> est content, chaque dollar lui rapporte plus d'euros. L'importateur paie plus cher.</>}
        {sens === 'haut' && <>EUR/USD <b>haut</b> : l'euro est fort. L'<b>importateur</b> est content, ses dollars lui coûtent moins d'euros. L'exportateur reçoit moins.</>}
        {!sens && <>Bouge le curseur. Le même montant en euros est une <b>recette</b> pour l'exportateur et un <b>coût</b> pour l'importateur : c'est pour cela qu'ils veulent le contraire.</>}
      </p>
      <p className="note">Exemple fictif. Calcul : montant en dollars ÷ EUR/USD.</p>
    </div>
  );
}

/* ---------- Pouvoir d'achat ---------- */
function PouvoirAchat() {
  const [inflation, setInflation] = useState(4);
  const [annees, setAnnees] = useState(10);
  const prix = niveauPrix(inflation, annees);
  const pouvoir = pouvoirAchat(100, inflation, annees);
  const L = 320, H = 150, x0 = 30, y0 = 12, w = L - x0 - 10, h = H - y0 - 24;
  const serie = Array.from({ length: annees + 1 }, (_, n) => ({ n, prix: niveauPrix(inflation, n), pa: pouvoirAchat(100, inflation, n) }));
  const max = Math.max(110, ...serie.map((s) => Math.max(s.prix, s.pa)));
  const min = Math.min(90, ...serie.map((s) => Math.min(s.prix, s.pa)));
  const X = (n: number) => x0 + (n / annees) * w;
  const Y = (v: number) => y0 + (1 - (v - min) / (max - min)) * h;
  const ligne = (cle: 'prix' | 'pa') => serie.map((s, i) => `${i ? 'L' : 'M'}${X(s.n).toFixed(1)},${Y(s[cle]).toFixed(1)}`).join(' ');
  return (
    <div className="outil">
      <Curseur libelle="Inflation par an" valeur={inflation} min={-3} max={15} pas={0.5} affiche={`${nf(inflation, 1)} %`} onChange={setInflation} />
      <Curseur libelle="Durée" valeur={annees} min={1} max={30} pas={1} affiche={`${annees} an${annees > 1 ? 's' : ''}`} onChange={setAnnees} />
      <svg viewBox={`0 0 ${L} ${H}`} role="img" aria-label="Prix du panier et pouvoir d'achat de 100 euros au fil des années">
        <line x1={x0} y1={Y(100)} x2={x0 + w} y2={Y(100)} className="repere" />
        <text x={2} y={Y(100) + 4} className="petit">100</text>
        <text x={x0} y={H - 4} className="petit">aujourd'hui</text>
        <text x={x0 + w} y={H - 4} className="petit" textAnchor="end">dans {annees} an{annees > 1 ? 's' : ''}</text>
        <path d={ligne('prix')} className="courbe c1" />
        <path d={ligne('pa')} className="courbe" />
      </svg>
      <div className="duo">
        <div><small><i className="trait c1" /> Prix d'un panier à 100 €</small><b>{nf(prix, 2)} €</b></div>
        <div><small><i className="trait" /> Ce qu'achètent 100 € gardés sans intérêt</small><b>{nf(pouvoir, 2)} €</b></div>
      </div>
      <p className="verdict">
        {inflation > 0 && <>À {nf(inflation, 1)} % par an, tes 100 € perdent <b>{nf(100 - pouvoir, 1)} %</b> de leur pouvoir d'achat en {annees} an{annees > 1 ? 's' : ''}.</>}
        {inflation === 0 && <>Prix stables : tes 100 € gardent leur valeur.</>}
        {inflation < 0 && <>Déflation : les prix baissent, tes 100 € achètent plus. Mais les salaires et l'emploi baissent aussi, et les dettes pèsent plus lourd.</>}
      </p>
    </div>
  );
}

/* ---------- Panier d'inflation ---------- */
const POSTES = [
  { cle: 'services', nom: 'Services', poids: 46, coeur: true },
  { cle: 'biens', nom: 'Biens industriels hors énergie', poids: 26, coeur: true },
  { cle: 'alim', nom: 'Alimentation, alcool, tabac', poids: 19, coeur: false },
  { cle: 'energie', nom: 'Énergie', poids: 9, coeur: false },
];
function PanierInflation() {
  const [h, setH] = useState<Record<string, number>>({ services: 3, biens: 1, alim: 2, energie: 20 });
  const postes = POSTES.map((p) => ({ ...p, hausse: h[p.cle] }));
  const totale = inflationPonderee(postes);
  const sousJacente = inflationPonderee(postes.filter((p) => p.coeur));
  const contribs = postes.map((p) => ({ ...p, c: contribution(p.poids, p.hausse) }));
  const echelle = Math.max(6, ...contribs.map((c) => Math.abs(c.c))) || 1;
  return (
    <div className="outil">
      {postes.map((p) => (
        <Curseur key={p.cle} libelle={`${p.nom} (${p.poids} % du panier)`} valeur={p.hausse} min={p.cle === 'energie' ? -30 : -2} max={p.cle === 'energie' ? 50 : 10} pas={0.5}
          affiche={`${p.hausse > 0 ? '+' : ''}${nf(p.hausse, 1)} %`} onChange={(v) => setH({ ...h, [p.cle]: v })} />
      ))}
      <div className="barres">
        {contribs.map((c) => (
          <div key={c.cle}>
            <span>{c.nom}</span>
            <i style={{ width: `${(Math.abs(c.c) / echelle) * 100}%` }} className={c.c < 0 ? 'neg' : c.coeur ? '' : 'c1'} />
            <span className="n">{c.c > 0 ? '+' : ''}{nf(c.c, 2)} pt</span>
          </div>
        ))}
      </div>
      <div className="duo">
        <div><small>Inflation totale</small><b>{nf(totale, 2)} %</b><em>tout le panier</em></div>
        <div><small>Inflation sous-jacente</small><b>{nf(sousJacente, 2)} %</b><em>services + biens seulement</em></div>
      </div>
      <p className="verdict">
        {Math.abs(totale - sousJacente) < 0.5
          ? <>Les deux mesures sont proches : la hausse des prix est <b>diffuse</b>, elle ne vient pas d'un seul poste.</>
          : totale > sousJacente
            ? <>L'inflation totale dépasse la sous-jacente de {nf(totale - sousJacente, 1)} point(s) : la hausse vient surtout de l'<b>énergie et de l'alimentation</b>. La banque centrale se demandera si elle va se propager.</>
            : <>L'inflation totale est sous la sous-jacente : l'énergie et l'alimentation <b>tirent le chiffre vers le bas</b>, mais la tendance de fond est plus élevée.</>}
      </p>
      <p className="note">Exemple fictif. Poids arrondis du panier de la zone euro (ordres de grandeur 2025, Eurostat). Barres : contribution de chaque poste, en points.</p>
    </div>
  );
}

export const OUTILS: Record<string, { titre: string; resume: string; module: number; rendu: () => ReactNode; fiche: string }> = {
  'labo.fx-calculateur': { titre: 'Exportateur ou importateur ?', resume: 'Ce que vaut un montant en dollars selon l\'EUR/USD.', module: 1, rendu: () => <FxCalculateur />, fiche: 'm1.change.exportateur' },
  'labo.pouvoir-achat': { titre: 'Ce que l\'inflation fait à 100 €', resume: 'Prix du panier et pouvoir d\'achat au fil des années.', module: 1, rendu: () => <PouvoirAchat />, fiche: 'm1.inflation.definition' },
  'labo.transmission': { titre: 'La chaîne de transmission', resume: "D'une décision de taux jusqu'à l'inflation, étape par étape.", module: 1, rendu: () => <Transmission />, fiche: 'm1.transmission.chaine' },
  'labo.gouverneur': { titre: 'Toi, gouverneur de la BCE', resume: 'Inflation, croissance, origine du choc : que décides-tu ?', module: 1, rendu: () => <Gouverneur />, fiche: 'm1.decision.choc-offre' },
  'labo.historique': { titre: 'Inflation et taux depuis 2014', resume: 'Les quatre grandes phases de la politique de la BCE.', module: 1, rendu: () => <Historique />, fiche: 'm1.episodes.vue-ensemble' },
  'labo.panier-inflation': { titre: 'Le panier d\'inflation', resume: 'Inflation totale et sous-jacente, poste par poste.', module: 1, rendu: () => <PanierInflation />, fiche: 'm1.inflation.mesure' },
  'labo.explorateur': { titre: "L'explorateur d'option", resume: 'Prime, valeur temps et grecques, avec tous les curseurs.', module: 2, rendu: () => <Explorateur />, fiche: 'm2.bases.prime' },
  'labo.grecques': { titre: 'Les grecques en images', resume: 'Delta, gamma, vega, thêta selon le sous-jacent et le temps restant.', module: 2, rendu: () => <GrecquesProfils />, fiche: 'm2.grecques.gamma' },
  'labo.couverture-delta': { titre: 'La couverture en delta', resume: 'Marché agité contre marché calme : le gamma contre le thêta.', module: 2, rendu: () => <CouvertureDelta />, fiche: 'm2.couverture.gamma-theta' },
  'labo.smile': { titre: 'Smile et skew', resume: 'La volatilité implicite selon le strike.', module: 2, rendu: () => <Smile />, fiche: 'm2.vol.smile-skew' },
  'labo.strategies': { titre: 'Les stratégies optionnelles', resume: 'Spreads, straddle, strangle, butterfly, risk reversal, collar.', module: 2, rendu: () => <Strategies />, fiche: 'm2.strategies.spreads' },
  'labo.binomial': { titre: "L'arbre binomial pas à pas", resume: 'Option européenne ou américaine, calculée nœud par nœud.', module: 2, rendu: () => <ArbreBinomial />, fiche: 'm2.modeles.binomial' },
  'labo.monte-carlo': { titre: 'Monte Carlo en direct', resume: "Des trajectoires simulées et une marge d'erreur qui fond en 1/√n.", module: 2, rendu: () => <MonteCarlo />, fiche: 'm2.modeles.monte-carlo' },
  'labo.obligation': { titre: 'Prix, duration et convexité', resume: "Comment le prix d'une obligation réagit au taux.", module: 3, rendu: () => <Obligation />, fiche: 'm3.duration.duration' },
  'labo.courbe': { titre: 'La courbe des taux', resume: 'Normale, plate, inversée, en bosse : taux zéro-coupon, forward et swap.', module: 3, rendu: () => <Courbe />, fiche: 'm3.courbe.formes' },
  'labo.swap': { titre: 'Un swap trimestre par trimestre', resume: 'Les flux de couverture et la valeur de marché du swap.', module: 3, rendu: () => <SwapFlux />, fiche: 'm3.swap.principe' },
  'labo.emprunteur': { titre: 'Swap, cap ou tunnel ?', resume: "Le taux réellement payé par un emprunteur selon l'Euribor.", module: 3, rendu: () => <Emprunteur />, fiche: 'm3.options-taux.cap-floor' },
  'labo.terme': { titre: 'Le cours à terme', resume: 'Fabriqué par arbitrage, étape par étape : report ou déport.', module: 4, rendu: () => <CoursTerme />, fiche: 'm4.terme.fabrication' },
  'labo.couvertures-fx': { titre: 'Couvrir un flux en dollars', resume: 'Terme, option, tunnel, terme participatif : exportateur ou importateur.', module: 4, rendu: () => <CouverturesFx />, fiche: 'm4.couvertures.terme-option' },
  'labo.capital-garanti': { titre: 'Construire un capital garanti', resume: 'Zéro-coupon + call : ce qui fait la participation.', module: 5, rendu: () => <CapitalGaranti />, fiche: 'm5.garanti.capital-garanti' },
  'labo.autocall': { titre: 'Autocall et Phoenix, date par date', resume: 'Rappel, coupons, mémoire et barrière de capital.', module: 5, rendu: () => <Autocall />, fiche: 'm5.autocall.athena' },
};
