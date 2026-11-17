// Outils du module 2 : explorateur d'option, grecques, couverture en delta, smile, stratégies, arbre binomial, Monte Carlo.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as o from '../finance/options';
import { nf } from '../lib';
import { Graphe, Legende, type Marqueur } from './graphe';

function Curseur(p: { libelle: string; valeur: number; min: number; max: number; pas: number; affiche: string; onChange: (v: number) => void }) {
  return (
    <label className="curseur">
      <span>{p.libelle}<output>{p.affiche}</output></span>
      <input type="range" min={p.min} max={p.max} step={p.pas} value={p.valeur} onChange={(e) => p.onChange(Number(e.target.value))} />
    </label>
  );
}

function Choix<T extends string>({ valeur, options, onChange, label }: { valeur: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, l]) => <button key={v} aria-pressed={valeur === v} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}

const pct = (v: number, d = 0) => `${nf(v * 100, d)} %`;
const signe = (v: number, d = 2) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${nf(Math.abs(v), d)}`;
const grille = (a: number, b: number, n = 80) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

/* ---------- 1. Explorateur d'option ---------- */
export function Explorateur() {
  const [sens, setSens] = useState<o.Sens>('call');
  const [pos, setPos] = useState<'achat' | 'vente'>('achat');
  const [S, setS] = useState(100);
  const [K, setK] = useState(100);
  const [sigma, setSigma] = useState(0.2);
  const [T, setT] = useState(1);
  const [r, setR] = useState(0.03);
  const q = pos === 'achat' ? 1 : -1;
  const res = o.bs(sens, { S, K, T, r, sigma });
  const vi = Math.max(sens === 'call' ? S - K : K - S, 0);
  const vt = res.prix - vi;
  const xs = grille(40, 160);
  const aujourdhui = xs.map((x) => [x, q * o.bs(sens, { S: x, K, T, r, sigma }).prix] as [number, number]);
  const echeance = xs.map((x) => [x, q * Math.max(sens === 'call' ? x - K : K - x, 0)] as [number, number]);
  const moneyness = Math.abs(S - K) < 1 ? 'à la monnaie' : (sens === 'call' ? S > K : S < K) ? 'dans la monnaie' : 'en dehors de la monnaie';
  const g = [
    ['Delta', q * res.delta, 3, 'Variation de la valeur si le sous-jacent monte de 1'],
    ['Gamma', q * res.gamma, 4, 'Variation du delta si le sous-jacent monte de 1'],
    ['Vega', (q * res.vega) / 100, 3, 'Variation de la valeur pour +1 point de volatilité'],
    ['Thêta', (q * res.theta) / 365, 4, 'Variation de la valeur en un jour qui passe'],
    ['Rho', (q * res.rho) / 100, 3, 'Variation de la valeur pour +1 point de taux'],
  ] as const;
  return (
    <div className="outil">
      <Choix label="Type d'option" valeur={sens} onChange={setSens} options={[['call', 'Call'], ['put', 'Put']]} />
      <Choix label="Position" valeur={pos} onChange={setPos} options={[['achat', 'Achat'], ['vente', 'Vente']]} />
      <Curseur libelle="Sous-jacent S" valeur={S} min={50} max={150} pas={1} affiche={nf(S)} onChange={setS} />
      <Curseur libelle="Strike K" valeur={K} min={60} max={140} pas={1} affiche={nf(K)} onChange={setK} />
      <Curseur libelle="Volatilité σ" valeur={sigma} min={0.05} max={0.6} pas={0.01} affiche={pct(sigma)} onChange={setSigma} />
      <Curseur libelle="Maturité" valeur={T} min={0.02} max={3} pas={0.01} affiche={T < 0.25 ? `${nf(T * 365)} jours` : `${nf(T, 2)} an${T >= 2 ? 's' : ''}`} onChange={setT} />
      <Curseur libelle="Taux r" valeur={r} min={0} max={0.08} pas={0.0025} affiche={pct(r, 2)} onChange={setR} />
      <Graphe titre="Valeur de la position selon le prix du sous-jacent" series={[{ points: echeance, classe: 'c1', pointille: true }, { points: aujourdhui }]}
        marqueurs={[{ x: S, y: q * res.prix }]} verticales={[{ x: K, label: 'K' }]} horizontales={[{ y: 0, classe: 'zero' }]} />
      <Legende items={[{ nom: "Valeur aujourd'hui" }, { nom: "Valeur à l'échéance", classe: 'c1', pointille: true }]} />
      <div className="duo trois">
        <div><small>Prime</small><b>{nf(res.prix, 2)}</b><em>{pos === 'achat' ? 'payée' : 'encaissée'}</em></div>
        <div><small>Valeur intrinsèque</small><b>{nf(vi, 2)}</b><em>{moneyness}</em></div>
        <div><small>Valeur temps</small><b>{nf(vt, 2)}</b><em>{nf(res.prix > 0 ? (vt / res.prix) * 100 : 0)} % de la prime</em></div>
      </div>
      <table className="grecques">
        <tbody>{g.map(([n, v, d, t]) => <tr key={n}><th>{n}</th><td className="n">{signe(v, d)}</td><td>{t}</td></tr>)}</tbody>
      </table>
      <p className="verdict">
        Ordre de grandeur à la monnaie : 0,4 × S × σ × √T = <b>{nf(o.approxATM(S, sigma, T), 2)}</b>.{' '}
        {pos === 'vente' ? 'En vente, tous les signes s’inversent : le vendeur encaisse la prime et le thêta, mais il est short gamma et short vega.' : 'À tester : passe la maturité à quelques jours et regarde la valeur temps fondre ; monte la volatilité et regarde la prime monter.'}
      </p>
      <p className="note">Black-Scholes, sans dividende. Vega et rho pour 1 point ; thêta par jour calendaire (÷ 365).</p>
    </div>
  );
}

/* ---------- 2. Les grecques selon le sous-jacent et le temps restant ---------- */
type Grecque = 'delta' | 'gamma' | 'vega' | 'theta';
const NOMS: Record<Grecque, string> = { delta: 'Delta', gamma: 'Gamma', vega: 'Vega (1 point)', theta: 'Thêta (par jour)' };
const valeurGrecque = (g: Grecque, r: o.Resultat) => (g === 'vega' ? r.vega / 100 : g === 'theta' ? r.theta / 365 : r[g]);
const LECTURES: Record<Grecque, [string, string]> = {
  delta: ['Le delta du call passe de 0 à 1 autour du strike. Plus l’échéance approche, plus la bascule est brutale : l’option devient presque tout ou rien.', 'Dans la monnaie, le delta tend vers 1 ; en dehors, vers 0 ; à la monnaie, il reste proche de 0,5 jusqu’au bout.'],
  gamma: ['Le gamma est en cloche, maximal autour du strike. Près de l’échéance, la cloche devient très haute et très étroite : le delta bascule au moindre mouvement.', 'À la monnaie, le gamma explose quand l’échéance approche ; loin de la monnaie, il tombe à zéro.'],
  vega: ['Le vega est maximal autour du strike, et d’autant plus grand que l’échéance est lointaine : une option longue est surtout un pari sur la volatilité.', 'Le vega diminue avec le temps restant : une option qui expire bientôt n’est presque plus sensible à la volatilité.'],
  theta: ['Le thêta est le plus négatif autour du strike : c’est l’option à la monnaie qui perd le plus de valeur temps chaque jour.', 'À la monnaie, l’érosion s’accélère quand l’échéance approche : la valeur temps fond de plus en plus vite.'],
};

export function GrecquesProfils() {
  const [g, setG] = useState<Grecque>('gamma');
  const [mode, setMode] = useState<'spot' | 'temps'>('spot');
  const [sens, setSens] = useState<o.Sens>('call');
  const base = { K: 100, r: 0.03, sigma: 0.2 };
  const series = mode === 'spot'
    ? ([[1, 'c2'], [0.25, 'c1'], [1 / 26, '']] as const).map(([T, classe]) => ({ classe, points: grille(60, 140).map((S) => [S, valeurGrecque(g, o.bs(sens, { ...base, S, T }))] as [number, number]) }))
    : ([[90, 'c2'], [100, ''], [110, 'c1']] as const).map(([S, classe]) => ({ classe, points: grille(1, 1 / 365, 120).map((T) => [T * 365, valeurGrecque(g, o.bs(sens, { ...base, S, T }))] as [number, number]) }));
  const leg = mode === 'spot'
    ? [{ nom: '1 an', classe: 'c2' }, { nom: '3 mois', classe: 'c1' }, { nom: '2 semaines' }]
    : [{ nom: 'S = 90', classe: 'c2' }, { nom: 'S = 100 (à la monnaie)' }, { nom: 'S = 110', classe: 'c1' }];
  return (
    <div className="outil">
      <Choix label="Grecque" valeur={g} onChange={setG} options={[['delta', 'Delta'], ['gamma', 'Gamma'], ['vega', 'Vega'], ['theta', 'Thêta']]} />
      <Choix label="Axe" valeur={mode} onChange={setMode} options={[['spot', 'Selon le sous-jacent'], ['temps', 'Selon le temps restant']]} />
      <Choix label="Type" valeur={sens} onChange={setSens} options={[['call', 'Call'], ['put', 'Put']]} />
      <Graphe titre={`${NOMS[g]} ${mode === 'spot' ? 'selon le prix du sous-jacent' : 'selon le nombre de jours restants'}`} series={series}
        verticales={mode === 'spot' ? [{ x: 100, label: 'K' }] : []} horizontales={[{ y: 0, classe: 'zero' }]}
        x={mode === 'temps' ? [365, 0] : undefined} xTicks={mode === 'temps' ? [365, 270, 180, 90, 0] : undefined}
        xFormat={mode === 'temps' ? (v) => `${nf(v)} j` : undefined} />
      <Legende items={leg} />
      <p className="verdict"><b>{NOMS[g]}.</b> {LECTURES[g][mode === 'spot' ? 0 : 1]}</p>
      <p className="note">Achat d'une option de strike 100, volatilité 20 %, taux 3 %. En vente, toutes les courbes changent de signe.</p>
    </div>
  );
}

/* ---------- 3. Couverture en delta animée ---------- */
interface Jour { j: number; S: number; delta: number; pnl: number; theta: number; achat: number }

function simulerCouverture(volReelle: number, graine: number, jours = 60): Jour[] {
  const volImp = 0.2, T0 = 0.5, dt = 1 / 252;
  const z = o.gaussien(o.generateur(graine));
  const res: Jour[] = [];
  let S = 100, pnl = 0, theta = 0;
  let r0 = o.bs('call', { S, K: 100, T: T0, r: 0, sigma: volImp });
  res.push({ j: 0, S, delta: r0.delta, pnl: 0, theta: 0, achat: 0 });
  for (let j = 1; j <= jours; j++) {
    const S2 = S * Math.exp(-0.5 * volReelle * volReelle * dt + volReelle * Math.sqrt(dt) * z());
    const r1 = o.bs('call', { S: S2, K: 100, T: T0 - j * dt, r: 0, sigma: volImp });
    pnl += r1.prix - r0.prix - r0.delta * (S2 - S); // option achetée, couverte par −delta actions
    theta += r0.theta * dt;
    res.push({ j, S: S2, delta: r1.delta, pnl, theta, achat: -(r1.delta - r0.delta) });
    S = S2; r0 = r1;
  }
  return res;
}

export function CouvertureDelta() {
  const [marche, setMarche] = useState<'agite' | 'calme'>('agite');
  const [graine, setGraine] = useState(3);
  const [jour, setJour] = useState(60);
  const [lecture, setLecture] = useState(false);
  const vol = marche === 'agite' ? 0.35 : 0.08;
  const serie = useMemo(() => simulerCouverture(vol, graine), [vol, graine]);
  useEffect(() => {
    if (!lecture) return;
    if (jour >= 60) { setLecture(false); return; }
    const t = setTimeout(() => setJour((j) => j + 1), 90);
    return () => clearTimeout(t);
  }, [lecture, jour]);
  const vus = serie.slice(0, jour + 1);
  const marq: Marqueur[] = vus.slice(1).filter((d) => Math.abs(d.achat) > 0.004).map((d) => ({ x: d.j, y: d.S, forme: d.achat > 0 ? 'haut' : 'bas', classe: d.achat > 0 ? 'pt-vert' : 'pt-rouge' }));
  const fin = vus[vus.length - 1];
  const realisee = vus.length > 2 ? o.volRealisee(vus.map((d) => d.S)) : 0;
  const yS: [number, number] = [Math.min(...serie.map((d) => d.S)) - 1, Math.max(...serie.map((d) => d.S)) + 1];
  const yP: [number, number] = [Math.min(0, ...serie.map((d) => Math.min(d.pnl, d.theta))) - 0.2, Math.max(0.2, ...serie.map((d) => d.pnl)) + 0.2];
  const lancer = () => { setJour(0); setLecture(true); };
  return (
    <div className="outil">
      <Choix label="Marché" valeur={marche} onChange={(v) => { setMarche(v); setJour(0); setLecture(true); }} options={[['agite', 'Marché agité (35 %)'], ['calme', 'Marché calme (8 %)']]} />
      <Graphe titre="Cours du sous-jacent jour après jour, avec les ajustements de couverture" hauteur={170}
        series={[{ points: vus.map((d) => [d.j, d.S]) }]} x={[0, 60]} y={yS} marqueurs={marq} xFormat={(v) => `J${nf(v)}`} />
      <Legende items={[{ nom: 'Le trader rachète (cours en baisse)', classe: 'vert' }, { nom: 'Le trader vend (cours en hausse)', classe: 'rouge' }]} />
      <Graphe titre="Résultat cumulé de l'option couverte, comparé au seul passage du temps" hauteur={170}
        series={[{ points: vus.map((d) => [d.j, d.theta]), classe: 'c1', pointille: true }, { points: vus.map((d) => [d.j, d.pnl]), classe: 'ok' }]}
        x={[0, 60]} y={yP} horizontales={[{ y: 0, classe: 'zero' }]} xFormat={(v) => `J${nf(v)}`} />
      <Legende items={[{ nom: 'Résultat couvert', classe: 'ok' }, { nom: 'Coût du thêta seul', classe: 'c1', pointille: true }]} />
      <div className="duo">
        <div className={fin.pnl > 0 ? 'bien' : 'mal'}><small>Résultat au jour {fin.j}</small><b>{signe(fin.pnl, 2)}</b><em>pour un call acheté {nf(o.bs('call', { S: 100, K: 100, T: 0.5, r: 0, sigma: 0.2 }).prix, 2)}</em></div>
        <div><small>Volatilité réalisée</small><b>{pct(realisee)}</b><em>contre 20 % payés (implicite)</em></div>
      </div>
      <div className="ligne">
        <button className="btn y" onClick={lancer}>▶ Rejouer</button>
        <button className="btn g" onClick={() => { setGraine(graine + 1); setJour(0); setLecture(true); }}>Nouveau scénario</button>
      </div>
      <p className="verdict">
        {jour < 60 ? 'Le trader a acheté un call et vendu « delta » actions. Chaque jour, il réajuste : il vend quand le cours monte, il rachète quand il baisse.'
          : realisee > 0.2 ? 'Marché agité : les allers-retours (vendre haut, racheter bas) ont rapporté plus que le thêta n’a coûté. Volatilité réalisée supérieure à l’implicite : l’acheteur long gamma gagne.'
            : 'Marché calme : le cours bouge trop peu pour compenser l’érosion quotidienne. Volatilité réalisée inférieure à l’implicite : c’est le vendeur, short gamma, qui gagne.'}
      </p>
      <p className="note">Call à la monnaie, 6 mois, volatilité implicite 20 %, taux nul, couverture ajustée chaque jour de bourse. Trajectoires simulées : exemple fictif.</p>
    </div>
  );
}

/* ---------- 4. Volatilité implicite : smile et skew ---------- */
type Forme = 'plat' | 'skew' | 'smile';
const volSmile = (forme: Forme, atm: number, intensite: number, K: number) => {
  const m = Math.log(K / 100);
  if (forme === 'plat') return atm;
  if (forme === 'skew') return Math.max(0.02, atm - intensite * 0.8 * m + intensite * 0.6 * m * m);
  return Math.max(0.02, atm + intensite * 2.2 * m * m + 0.05 * intensite * m);
};

export function Smile() {
  const [forme, setForme] = useState<Forme>('skew');
  const [atm, setAtm] = useState(0.2);
  const [intensite, setIntensite] = useState(0.5);
  const courbe = grille(70, 130).map((K) => [K, volSmile(forme, atm, intensite, K) * 100] as [number, number]);
  const options: [o.Sens, number, string][] = [['put', 85, 'Put 85'], ['put', 95, 'Put 95'], ['call', 100, 'Call 100'], ['call', 115, 'Call 115']];
  return (
    <div className="outil">
      <Choix label="Forme" valeur={forme} onChange={setForme} options={[['plat', 'Black-Scholes (plat)'], ['skew', 'Actions (skew)'], ['smile', 'Change (smile)']]} />
      <Curseur libelle="Volatilité à la monnaie" valeur={atm} min={0.05} max={0.5} pas={0.01} affiche={pct(atm)} onChange={setAtm} />
      {forme !== 'plat' && <Curseur libelle="Intensité" valeur={intensite} min={0} max={1} pas={0.05} affiche={nf(intensite * 100) + ' %'} onChange={setIntensite} />}
      <Graphe titre="Volatilité implicite selon le strike" series={[{ points: courbe }, { points: [[70, atm * 100], [130, atm * 100]], classe: 'c1', pointille: true }]}
        verticales={[{ x: 100, label: 'S = 100' }]} yFormat={(v) => `${nf(v)} %`} />
      <Legende items={[{ nom: 'Volatilité implicite de marché' }, { nom: 'Black-Scholes : une seule volatilité', classe: 'c1', pointille: true }]} />
      <table className="grecques">
        <thead><tr><th>Option (1 an)</th><th className="n">Vol.</th><th className="n">Prix</th><th className="n">Si vol. plate</th></tr></thead>
        <tbody>{options.map(([s, K, nom]) => {
          const v = volSmile(forme, atm, intensite, K);
          const p = o.bs(s, { S: 100, K, T: 1, r: 0.03, sigma: v }).prix, p0 = o.bs(s, { S: 100, K, T: 1, r: 0.03, sigma: atm }).prix;
          return <tr key={nom}><th>{nom}</th><td className="n">{pct(v, 1)}</td><td className="n">{nf(p, 2)}</td><td className="n">{nf(p0, 2)}</td></tr>;
        })}</tbody>
      </table>
      <p className="verdict">
        {forme === 'plat' && 'Dans le monde de Black-Scholes, la volatilité est la même pour tous les strikes. Le marché ne fonctionne pas ainsi.'}
        {forme === 'skew' && 'Sur les actions, les puts en dehors de la monnaie (strikes bas) se traitent à une volatilité plus élevée : c’est le skew. Les investisseurs paient cher la protection contre un krach, et les baisses s’accompagnent de volatilité.'}
        {forme === 'smile' && 'En change, les deux ailes sont chères : un grand mouvement est possible dans les deux sens. La courbe a la forme d’un sourire.'}
      </p>
      <p className="note">Formes stylisées, exemple fictif. Prix Black-Scholes avec S = 100, taux 3 %.</p>
    </div>
  );
}

/* ---------- 5. Stratégies ---------- */
const STRATEGIES: Record<string, { nom: string; jambes: o.Jambe[]; texte: string }> = {
  call: { nom: 'Achat de call', jambes: [{ type: 'call', K: 100, quantite: 1 }], texte: 'Vue haussière, perte limitée à la prime.' },
  put: { nom: 'Achat de put', jambes: [{ type: 'put', K: 100, quantite: 1 }], texte: 'Vue baissière ou assurance d’un portefeuille ; perte limitée à la prime.' },
  callSpread: { nom: 'Call spread', jambes: [{ type: 'call', K: 100, quantite: 1 }, { type: 'call', K: 110, quantite: -1 }], texte: 'Vue modérément haussière : on revend le call 110 pour payer moins cher, en plafonnant le gain.' },
  putSpread: { nom: 'Put spread', jambes: [{ type: 'put', K: 100, quantite: 1 }, { type: 'put', K: 90, quantite: -1 }], texte: 'Protection contre une baisse modérée, moins chère qu’un put seul.' },
  straddle: { nom: 'Straddle', jambes: [{ type: 'call', K: 100, quantite: 1 }, { type: 'put', K: 100, quantite: 1 }], texte: 'Pari sur un grand mouvement, dans un sens ou dans l’autre : on achète de la volatilité.' },
  strangle: { nom: 'Strangle', jambes: [{ type: 'call', K: 110, quantite: 1 }, { type: 'put', K: 90, quantite: 1 }], texte: 'Comme le straddle, en moins cher, mais il faut un mouvement plus grand.' },
  butterfly: { nom: 'Butterfly', jambes: [{ type: 'call', K: 90, quantite: 1 }, { type: 'call', K: 100, quantite: -2 }, { type: 'call', K: 110, quantite: 1 }], texte: 'Pari sur un marché qui reste près de 100 ; risque et gain limités. On vend de la volatilité à moindre risque.' },
  riskReversal: { nom: 'Risk reversal', jambes: [{ type: 'call', K: 110, quantite: 1 }, { type: 'put', K: 90, quantite: -1 }], texte: 'Achat du call financé par la vente du put : exposé à la hausse comme à la forte baisse. Son prix mesure le skew.' },
  collar: { nom: 'Collar', jambes: [{ type: 'sous-jacent', quantite: 1 }, { type: 'put', K: 90, quantite: 1 }, { type: 'call', K: 120, quantite: -1 }], texte: 'Détenteur de l’action : il achète un put 90 et vend un call 120. Protégé sous 90, il renonce aux gains au-dessus de 120. Ici, à coût presque nul.' },
};

export function Strategies() {
  const [cle, setCle] = useState('straddle');
  const s = STRATEGIES[cle];
  const p = { S: 100, T: 1, r: 0.03, sigma: 0.2 };
  const cout = o.valeurStrategie(s.jambes, p, 100);
  const xs = grille(60, 140, 160);
  const echeance = xs.map((x) => [x, o.gainEcheance(s.jambes, x, 100) - cout] as [number, number]);
  const auj = xs.map((x) => [x, o.valeurStrategie(s.jambes, { ...p, S: x }, 100) - cout] as [number, number]);
  const pm: number[] = [];
  for (let i = 1; i < echeance.length; i++) if (Math.sign(echeance[i][1]) !== Math.sign(echeance[i - 1][1]) && echeance[i][1] !== 0) pm.push(echeance[i][0]);
  const large = grille(0, 400, 800).map((x) => o.gainEcheance(s.jambes, x, 100) - cout);
  const gainMax = Math.max(...large), perteMax = Math.min(...large);
  const illimite = o.gainEcheance(s.jambes, 1000, 100) > o.gainEcheance(s.jambes, 400, 100) + 1;
  return (
    <div className="outil">
      <div className="seg" role="group" aria-label="Stratégie">
        {Object.entries(STRATEGIES).map(([k, v]) => <button key={k} aria-pressed={cle === k} onClick={() => setCle(k)}>{v.nom}</button>)}
      </div>
      <Graphe titre={`Résultat de la stratégie ${s.nom}`} series={[{ points: auj, classe: 'c1', pointille: true }, { points: echeance }]}
        horizontales={[{ y: 0, classe: 'zero' }]} verticales={pm.map((x) => ({ x }))} marqueurs={[{ x: 100, y: 0 }]} />
      <Legende items={[{ nom: "Résultat à l'échéance" }, { nom: "Résultat si on débouclait aujourd'hui", classe: 'c1', pointille: true }]} />
      <ul className="jambes">{s.jambes.map((j, i) => <li key={i}>{j.quantite > 0 ? 'Achat' : 'Vente'} {Math.abs(j.quantite) > 1 ? `${Math.abs(j.quantite)} ` : ''}{j.type === 'sous-jacent' ? 'du sous-jacent à 100' : `${j.type} ${j.K}`}</li>)}</ul>
      <div className="duo trois">
        <div><small>Coût net</small><b>{signe(cout)}</b><em>{cout > 0 ? 'payé' : cout < 0 ? 'encaissé' : 'nul'}</em></div>
        <div><small>Résultat max.</small><b>{illimite ? 'illimité' : signe(gainMax)}</b></div>
        <div><small>Perte max.</small><b>{signe(perteMax)}</b></div>
      </div>
      <p className="verdict"><b>{s.nom}.</b> {s.texte}{pm.length > 0 && <> Point(s) mort(s) à l'échéance : {pm.map((x) => nf(x, 1)).join(' et ')}.</>}</p>
      <p className="note">Prix Black-Scholes, S = 100, 1 an, volatilité 20 %, taux 3 %. Résultat net de la prime. Exemple fictif.</p>
    </div>
  );
}

/* ---------- 6. Arbre binomial pas à pas ---------- */
export function ArbreBinomial() {
  const [n, setN] = useState(3);
  const [sens, setSens] = useState<o.Sens>('put');
  const [style, setStyle] = useState<'eu' | 'am'>('am');
  const [etape, setEtape] = useState(0); // 0 : arbre des prix ; k ≥ 1 : colonnes n, n−1, … calculées
  const a = o.arbreBinomial(sens, 100, 100, 1, 0.03, 0.2, n, style === 'am');
  const L = 340, H = 220, x0 = 30, w = L - 60;
  const X = (i: number) => x0 + (i / n) * w;
  const Y = (i: number, j: number) => H / 2 - (j - i / 2) * (H - 40) / Math.max(n, 2);
  const calcule = (i: number) => etape >= 1 && i >= n - (etape - 1);
  const fini = etape >= n + 1;
  const ref = o.bs(sens, { S: 100, K: 100, T: 1, r: 0.03, sigma: 0.2 }).prix;
  const conv = useMemo(() => Array.from({ length: 60 }, (_, k) => [k + 1, o.binomial(sens, 100, 100, 1, 0.03, 0.2, k + 1, style === 'am')] as [number, number]), [sens, style]);
  const reset = (f: () => void) => { f(); setEtape(0); };
  return (
    <div className="outil">
      <Choix label="Type" valeur={sens} onChange={(v) => reset(() => setSens(v))} options={[['call', 'Call'], ['put', 'Put']]} />
      <Choix label="Exercice" valeur={style} onChange={(v) => reset(() => setStyle(v))} options={[['eu', 'Européenne'], ['am', 'Américaine']]} />
      <Curseur libelle="Nombre d'étapes" valeur={n} min={1} max={5} pas={1} affiche={String(n)} onChange={(v) => reset(() => setN(v))} />
      <svg viewBox={`0 0 ${L} ${H}`} className="graphe arbre" role="img" aria-label="Arbre binomial des prix et des valeurs de l'option">
        {a.S.slice(0, n).map((col, i) => col.map((_, j) => (
          <g key={`${i}-${j}`}>
            <line x1={X(i)} y1={Y(i, j)} x2={X(i + 1)} y2={Y(i + 1, j + 1)} className="axe" />
            <line x1={X(i)} y1={Y(i, j)} x2={X(i + 1)} y2={Y(i + 1, j)} className="axe" />
          </g>
        )))}
        {a.S.map((col, i) => col.map((s, j) => (
          <g key={`n${i}-${j}`} className={`noeud ${calcule(i) && a.exerce[i][j] && i < n ? 'exerce' : ''} ${calcule(i) ? 'calcule' : ''}`}>
            <rect x={X(i) - 22} y={Y(i, j) - 13} width={44} height={26} rx={5} />
            <text x={X(i)} y={Y(i, j) - 2} textAnchor="middle" className="petit">{nf(s, 1)}</text>
            {calcule(i) && <text x={X(i)} y={Y(i, j) + 9} textAnchor="middle" className="petit val">{nf(a.V[i][j], 2)}</text>}
          </g>
        )))}
      </svg>
      <div className="ligne">
        <button className="btn y" disabled={fini} onClick={() => setEtape(etape + 1)}>{etape === 0 ? 'Calculer les gains à l’échéance' : 'Remonter d’une étape'}</button>
        <button className="btn g" onClick={() => setEtape(0)}>Recommencer</button>
      </div>
      <p className="verdict">
        {etape === 0 && <>Chaque étape, le prix est multiplié par u = {nf(a.u, 4)} (hausse) ou d = {nf(a.d, 4)} (baisse). La probabilité risque-neutre de hausse est p = {nf(a.p, 4)}. Commence par l'échéance.</>}
        {etape === 1 && <>À l'échéance, l'option vaut simplement son gain : {sens === 'call' ? 'max(S − 100, 0)' : 'max(100 − S, 0)'}.</>}
        {etape > 1 && !fini && <>À chaque nœud : valeur = moyenne pondérée des deux nœuds suivants (p et 1 − p), actualisée d'une étape.{style === 'am' && ' Pour l’américaine, on compare avec l’exercice immédiat et on garde le plus grand : les nœuds en jaune sont ceux où exercer tout de suite vaut plus.'}</>}
        {fini && <>Prix de l'option : <b>{nf(a.prix, 4)}</b> avec {n} étape{n > 1 ? 's' : ''}. Black-Scholes (européenne) : {nf(ref, 4)}.{style === 'am' && sens === 'put' && ' Le put américain vaut plus que l’européen : le droit d’exercer tôt a une valeur.'}{style === 'am' && sens === 'call' && ' Sans dividende, exercer un call tôt n’est jamais optimal : américain et européen ont le même prix.'}</>}
      </p>
      <Graphe titre="Prix selon le nombre d'étapes" hauteur={150} series={[{ points: conv }]} horizontales={style === 'eu' ? [{ y: ref, label: 'Black-Scholes', classe: 'cible' }] : []} xFormat={(v) => `${nf(v)}`} />
      <p className="note">S = 100, K = 100, 1 an, taux 3 %, volatilité 20 %. Le prix oscille puis se stabilise quand le nombre d'étapes augmente.</p>
    </div>
  );
}

/* ---------- 7. Monte Carlo animé ---------- */
export function MonteCarlo() {
  const [n, setN] = useState(0);
  const [graine, setGraine] = useState(1);
  const etat = useRef({ somme: 0, carres: 0, z: o.gaussien(o.generateur(1)), chemins: [] as [number, number][][], hist: [] as [number, number, number][] });
  const ref = o.bs('call', { S: 100, K: 100, T: 1, r: 0.03, sigma: 0.2 }).prix;
  const disc = Math.exp(-0.03);
  const ajouter = (k: number) => {
    const e = etat.current;
    for (let i = 0; i < k; i++) {
      let S = 100;
      const dessiner = e.chemins.length < 40;
      const chemin: [number, number][] = dessiner ? [[0, 100]] : [];
      for (let t = 1; t <= 12; t++) {
        S *= Math.exp((0.03 - 0.02) / 12 + 0.2 * Math.sqrt(1 / 12) * e.z());
        if (dessiner) chemin.push([t, S]);
      }
      if (dessiner) e.chemins.push(chemin);
      const g = disc * Math.max(S - 100, 0);
      e.somme += g; e.carres += g * g;
      const total = n + i + 1;
      if (total >= 10 && total % Math.pow(10, Math.max(1, Math.floor(Math.log10(total)))) === 0) {
        const m = e.somme / total;
        e.hist.push([total, m, Math.sqrt(Math.max(e.carres / total - m * m, 0) / total)]);
      }
    }
    setN(n + k);
  };
  const reset = () => { etat.current = { somme: 0, carres: 0, z: o.gaussien(o.generateur(graine + 1)), chemins: [], hist: [] }; setGraine(graine + 1); setN(0); };
  const e = etat.current;
  const m = n ? e.somme / n : 0;
  const err = n > 1 ? Math.sqrt(Math.max(e.carres / n - m * m, 0) / n) : 0;
  const hist = e.hist.filter((h) => h[0] >= 10);
  return (
    <div className="outil">
      <Graphe titre="Quelques trajectoires simulées du sous-jacent sur un an" hauteur={160}
        series={e.chemins.length ? e.chemins.map((c) => ({ points: c, classe: 'fin' })) : [{ points: [[0, 100], [12, 100]], classe: 'fin' }]}
        x={[0, 12]} horizontales={[{ y: 100, label: 'K = 100', classe: 'cible' }]} xFormat={(v) => `${nf(v)} m`} />
      <div className="ligne">
        <button className="btn y" onClick={() => ajouter(100)}>+100</button>
        <button className="btn y" onClick={() => ajouter(1000)}>+1 000</button>
        <button className="btn y" onClick={() => ajouter(10000)}>+10 000</button>
        <button className="btn g" onClick={reset}>Recommencer</button>
      </div>
      <div className="duo trois">
        <div><small>Trajectoires</small><b>{n.toLocaleString('fr-FR')}</b></div>
        <div><small>Estimation</small><b>{n ? nf(m, 3) : '—'}</b><em>{n > 1 ? `± ${nf(2 * err, 3)} (95 %)` : ''}</em></div>
        <div><small>Black-Scholes</small><b>{nf(ref, 3)}</b></div>
      </div>
      {hist.length > 1 && (
        <>
          <Graphe titre="Estimation selon le nombre de trajectoires, avec sa marge d'erreur" hauteur={160}
            series={[{ points: hist.map((h) => [Math.log10(h[0]), h[1]]) }]}
            bandes={[{ points: hist.map((h) => [Math.log10(h[0]), h[1] - 2 * h[2], h[1] + 2 * h[2]]) }]}
            horizontales={[{ y: ref, label: 'Black-Scholes', classe: 'cible' }]}
            xTicks={[1, 2, 3, 4, 5].filter((t) => t <= Math.log10(Math.max(n, 10)) + 0.01)} xFormat={(v) => Math.pow(10, v).toLocaleString('fr-FR')} />
          <Legende items={[{ nom: 'Estimation' }, { nom: 'Marge d’erreur à 95 %', classe: 'bande' }]} />
        </>
      )}
      <p className="verdict">
        {n === 0 ? 'On simule des trajectoires possibles du sous-jacent, on calcule le gain du call au bout de chacune, et on fait la moyenne, actualisée. Ajoute des trajectoires.'
          : `La marge d'erreur se réduit comme 1/√n : il faut 100 fois plus de trajectoires pour être 10 fois plus précis. Avec ${n.toLocaleString('fr-FR')} trajectoires, l'écart avec Black-Scholes est de ${nf(Math.abs(m - ref), 3)}.`}
      </p>
      <p className="note">Call européen, S = K = 100, 1 an, taux 3 %, volatilité 20 %, 12 pas mensuels par trajectoire. Tirages pseudo-aléatoires reproductibles.</p>
    </div>
  );
}
