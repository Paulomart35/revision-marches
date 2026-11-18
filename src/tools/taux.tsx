// Outils du module 3 : obligation (prix, duration, convexité), courbe des taux, swap trimestre par trimestre, taux effectif d'un emprunteur.
import { useState } from 'react';
import * as tx from '../finance/taux';
import { eur, nf } from '../lib';
import { Choix, Curseur, grille } from './commun';
import { Graphe, Legende } from './graphe';

const pc = (v: number, d = 2) => `${nf(v, d)} %`;
const signe = (v: number, d = 2) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${nf(Math.abs(v), d)}`;

/* ---------- 1. Prix d'une obligation, duration et convexité ---------- */
export function Obligation() {
  const [coupon, setCoupon] = useState(3);
  const [annees, setAnnees] = useState(10);
  const [taux, setTaux] = useState(3);
  const [choc, setChoc] = useState(100);
  const prix = tx.prixObligation(coupon, taux, annees);
  const D = tx.durationMacaulay(coupon, taux, annees);
  const S = tx.sensibilite(coupon, taux, annees);
  const C = tx.convexite(coupon, taux, annees);
  const dv = tx.dv01(coupon, taux, annees, 1_000_000);
  const exacte = tx.variationPrixExacte(coupon, taux, annees, choc);
  const sansC = tx.variationPrixApprochee(coupon, taux, annees, choc, 0);
  const avecC = tx.variationPrixApprochee(coupon, taux, annees, choc);
  const xs = grille(0, 10, 100);
  const courbe = xs.map((y) => [y, tx.prixObligation(coupon, y, annees)] as [number, number]);
  const tangente = xs.map((y) => [y, prix * (1 - (S * (y - taux)) / 100)] as [number, number]);
  const t2 = taux + choc / 100;
  return (
    <div className="outil">
      <Curseur libelle="Coupon annuel" valeur={coupon} min={0} max={8} pas={0.25} affiche={pc(coupon)} onChange={setCoupon} />
      <Curseur libelle="Maturité" valeur={annees} min={1} max={30} pas={1} affiche={`${annees} an${annees > 1 ? 's' : ''}`} onChange={setAnnees} />
      <Curseur libelle="Taux du marché (rendement)" valeur={taux} min={0} max={10} pas={0.05} affiche={pc(taux)} onChange={setTaux} />
      <Graphe titre="Prix de l'obligation selon le taux du marché" series={[{ points: courbe }, { points: tangente, classe: 'c1', pointille: true }]}
        x={[0, 10]} xFormat={(v) => `${nf(v)} %`} marqueurs={[{ x: taux, y: prix }, ...(t2 >= 0 && t2 <= 10 ? [{ x: t2, y: tx.prixObligation(coupon, t2, annees), classe: 'pt1' }] : [])]}
        horizontales={[{ y: 100, label: 'pair (100)' }]} />
      <Legende items={[{ nom: 'Prix réel' }, { nom: 'Approximation par la duration (droite)', classe: 'c1', pointille: true }]} />
      <table className="grecques">
        <tbody>
          <tr><td>Prix (pour 100)</td><td className="n">{nf(prix, 2)}</td><td>{Math.abs(prix - 100) < 0.05 ? 'au pair : coupon = taux' : prix > 100 ? 'au-dessus du pair : coupon > taux' : 'sous le pair : coupon < taux'}</td></tr>
          <tr><td>Duration</td><td className="n">{nf(D, 2)} ans</td><td>durée de vie moyenne des flux, pondérée par leur valeur</td></tr>
          <tr><td>Sensibilité</td><td className="n">{nf(S, 2)}</td><td>−{nf(S, 2)} % de prix pour +1 point de taux</td></tr>
          <tr><td>DV01 (1 M€)</td><td className="n">{eur(dv)}</td><td>gain pour −1 point de base</td></tr>
          <tr><td>Convexité</td><td className="n">{nf(C, 1)}</td><td>courbure : la droite sous-estime le prix</td></tr>
        </tbody>
      </table>
      <Curseur libelle="Choc de taux" valeur={choc} min={-200} max={200} pas={25} affiche={`${signe(choc, 0)} pb`} onChange={setChoc} />
      <div className="duo">
        <div><small>Variation réelle du prix</small><b>{signe(exacte)} %</b><em>prix recalculé</em></div>
        <div><small>Par la sensibilité seule</small><b>{signe(sansC)} %</b><em>avec la convexité : {signe(avecC)} %</em></div>
      </div>
      <p className="verdict">
        Quand le taux monte, le prix baisse : les flux futurs, fixés, valent moins une fois actualisés à un taux plus haut. Plus la maturité est longue et le coupon faible, plus la sensibilité est forte.
        {Math.abs(choc) >= 100 && <> Pour un choc de {signe(choc, 0)} pb, la droite se trompe de {nf(Math.abs(exacte - sansC), 2)} point(s) : la convexité corrige l'écart, toujours en faveur du détenteur.</>}
      </p>
      <p className="note">Exemple fictif. Obligation à coupon annuel, remboursée 100 à l'échéance.</p>
    </div>
  );
}

/* ---------- 2. La courbe des taux ---------- */
type Forme = 'normale' | 'plate' | 'inversee' | 'bosse';
const FORMES: Record<Forme, { court: number; long: number; bosse: number; texte: string }> = {
  normale: { court: 2, long: 3.5, bosse: 0, texte: "Courbe normale (pentue) : prêter longtemps rapporte plus. Le marché attend des taux courts stables ou en hausse, et demande une prime pour immobiliser son argent. C'est la forme la plus fréquente." },
  plate: { court: 3, long: 3, bosse: 0, texte: "Courbe plate : prêter 1 an ou 10 ans rapporte presque pareil. Souvent une transition : le marché hésite entre la poursuite du cycle et un ralentissement." },
  inversee: { court: 4.5, long: 3, bosse: 0, texte: "Courbe inversée : les taux courts dépassent les taux longs. La banque centrale a monté ses taux et le marché anticipe qu'elle devra les baisser, souvent parce qu'il craint un ralentissement. Historiquement, aux États-Unis, une inversion a souvent précédé une récession, sans que ce soit une loi." },
  bosse: { court: 2.5, long: 3, bosse: 1.4, texte: "Courbe en bosse : les taux à 2-3 ans dépassent à la fois les taux courts et longs. Le marché attend des hausses à court terme, puis des baisses plus tard." },
};
export function Courbe() {
  const [forme, setForme] = useState<Forme>('normale');
  const [court, setCourt] = useState(FORMES.normale.court);
  const [long, setLong] = useState(FORMES.normale.long);
  const bosse = FORMES[forme].bosse;
  const zc = (t: number) => long + (court - long) * Math.exp(-t / 2.5) + bosse * (t / 2) * Math.exp(1 - t / 2);
  const mats = Array.from({ length: 10 }, (_, i) => i + 1);
  const zcs = mats.map(zc);
  const fwd = mats.map((t) => (t === 1 ? zcs[0] : tx.tauxForward(zcs[t - 2], t - 1, zcs[t - 1], t)));
  const sw = mats.map((t) => tx.tauxSwap(...zcs.slice(0, t)));
  const choisir = (f: Forme) => { setForme(f); setCourt(FORMES[f].court); setLong(FORMES[f].long); };
  return (
    <div className="outil">
      <Choix label="Forme de la courbe" valeur={forme} onChange={choisir} options={[['normale', 'Normale'], ['plate', 'Plate'], ['inversee', 'Inversée'], ['bosse', 'En bosse']]} />
      <Curseur libelle="Taux court (1 an)" valeur={court} min={0} max={6} pas={0.25} affiche={pc(court)} onChange={setCourt} />
      <Curseur libelle="Taux long (vers 10 ans)" valeur={long} min={0} max={6} pas={0.25} affiche={pc(long)} onChange={setLong} />
      <Graphe titre="Courbe zéro-coupon, taux forward à un an et taux de swap" x={[1, 10]} xFormat={(v) => `${nf(v)} a`} yFormat={(v) => `${nf(v, 1)} %`}
        series={[{ points: mats.map((t, i) => [t, zcs[i]]) }, { points: mats.map((t, i) => [t, fwd[i]]), classe: 'c1', pointille: true }, { points: mats.map((t, i) => [t, sw[i]]), classe: 'c2' }]} />
      <Legende items={[{ nom: 'Taux zéro-coupon' }, { nom: 'Taux forward 1 an (dans t − 1 ans)', classe: 'c1', pointille: true }, { nom: 'Taux de swap', classe: 'c2' }]} />
      <table className="grecques">
        <thead><tr><th>Maturité</th><th>Zéro-coupon</th><th>Forward 1 an</th><th>Swap</th></tr></thead>
        <tbody>{[2, 5, 10].map((t) => <tr key={t}><td>{t} ans</td><td className="n">{pc(zcs[t - 1])}</td><td className="n">{pc(fwd[t - 1])}</td><td className="n">{pc(sw[t - 1])}</td></tr>)}</tbody>
      </table>
      <p className="verdict">{FORMES[forme].texte} Pente 10 ans − 1 an : <b>{signe((zcs[9] - zcs[0]) * 100, 0)} pb</b>.</p>
      <p className="note">Courbes fictives. Le forward est au-dessus de la courbe quand elle monte, en dessous quand elle descend. Le taux de swap est une moyenne des forwards : il reste proche du zéro-coupon.</p>
    </div>
  );
}

/* ---------- 3. Un swap trimestre par trimestre ---------- */
type Trajectoire = 'bosse' | 'hausse' | 'baisse';
const TRAJ: Record<Trajectoire, (q: number) => number> = {
  bosse: (q) => 2.2 + 1.8 * Math.sin((Math.PI * q) / 19), // monte puis redescend
  hausse: (q) => 2 + (2.6 * q) / 19,
  baisse: (q) => 3.2 - (2.2 * q) / 19,
};
export function SwapFlux() {
  const [traj, setTraj] = useState<Trajectoire>('bosse');
  const [fixe, setFixe] = useState(3);
  const [marche, setMarche] = useState(3.5);
  const [restant, setRestant] = useState(4);
  const N = 10_000_000, marge = 1.2;
  const eurib = Array.from({ length: 20 }, (_, q) => Math.round(TRAJ[traj](q) * 100) / 100);
  const flux = eurib.map((e) => tx.fluxSwap(N, fixe, e, 90));
  const cumul = flux.reduce((a, b) => a + b, 0);
  const mtm = tx.valeurSwapPayeur(N, fixe, marche, restant);
  const dv = (N * 0.0001) * tx.annuite(marche, restant);
  const L = 340, H = 110, x0 = 10, w = L - 20, mid = H / 2, max = Math.max(...flux.map(Math.abs), 1);
  return (
    <div className="outil">
      <Choix label="Trajectoire de l'Euribor" valeur={traj} onChange={setTraj} options={[['bosse', 'Monte puis baisse'], ['hausse', 'Hausse'], ['baisse', 'Baisse']]} />
      <Curseur libelle="Taux fixe du swap" valeur={fixe} min={1} max={5} pas={0.05} affiche={pc(fixe)} onChange={setFixe} />
      <Graphe titre="Coût du crédit avec et sans swap, sur 20 trimestres" x={[1, 20]} xFormat={(v) => `T${nf(v)}`} yFormat={(v) => `${nf(v, 1)} %`}
        series={[{ points: eurib.map((e, i) => [i + 1, e + marge]), classe: 'c1' }, { points: eurib.map((_, i) => [i + 1, fixe + marge]), classe: 'ok' }]} />
      <Legende items={[{ nom: 'Sans couverture : Euribor + 1,20 %', classe: 'c1' }, { nom: `Avec le swap : ${pc(fixe)} + 1,20 %`, classe: 'ok' }]} />
      <svg viewBox={`0 0 ${L} ${H}`} role="img" aria-label="Flux nets du swap chaque trimestre">
        <line x1={x0} x2={x0 + w} y1={mid} y2={mid} className="axe" />
        {flux.map((f, i) => {
          const bw = w / 20 - 3, x = x0 + (i * w) / 20, hh = (Math.abs(f) / max) * (mid - 12);
          return <rect key={i} x={x} width={bw} y={f >= 0 ? mid - hh : mid} height={hh} className={f >= 0 ? 'pt-vert' : 'pt-rouge'} />;
        })}
        <text x={x0} y={10} className="petit">reçu par l'entreprise</text>
        <text x={x0} y={H - 2} className="petit">payé par l'entreprise</text>
      </svg>
      <p className="verdict">
        Chaque trimestre, l'entreprise paie {pc(fixe)} et reçoit l'Euribor sur 10 M€ : le flux du swap compense exactement l'écart avec son crédit. En vert, les trimestres où l'Euribor dépasse le fixe (le swap lui verse la différence) ; en rouge, ceux où il est en dessous (elle paie la différence). Son coût reste <b>{pc(fixe + marge)}</b>. Sur ces 5 ans, le swap lui a {cumul >= 0 ? 'rapporté' : 'coûté'} <b>{eur(Math.abs(cumul))}</b> par rapport au crédit non couvert.
      </p>
      <h4>La valeur du swap aujourd'hui</h4>
      <Curseur libelle="Taux de swap du marché aujourd'hui" valeur={marche} min={0.5} max={6} pas={0.05} affiche={pc(marche)} onChange={setMarche} />
      <Curseur libelle="Années restantes" valeur={restant} min={1} max={10} pas={1} affiche={`${restant} an${restant > 1 ? 's' : ''}`} onChange={setRestant} />
      <div className="duo">
        <div className={mtm >= 0 ? 'bien' : 'mal'}><small>Valeur de marché pour l'entreprise (payeuse du fixe)</small><b>{signe(mtm / 1000, 0)} k€</b><em>{mtm >= 0 ? 'la banque lui doit cette somme si on sortait aujourd\'hui' : 'elle devrait payer cette soulte pour sortir'}</em></div>
        <div><small>DV01</small><b>{eur(dv)}</b><em>par point de base de hausse des taux</em></div>
      </div>
      <p className="note">Exemple fictif : crédit de 10 M€ à Euribor 3 mois + 1,20 %, trimestres de 90 jours (base 360). Valeur de marché calculée avec une courbe plate au taux de swap du marché, paiements annuels.</p>
    </div>
  );
}

/* ---------- 4. Taux effectif d'un emprunteur : sans couverture, swap, cap, tunnel ---------- */
export function Emprunteur() {
  const [e, setE] = useState(2.75);
  const [swap, setSwap] = useState(3);
  const [strike, setStrike] = useState(3.25);
  const [prime, setPrime] = useState(0.3);
  const [plancher, setPlancher] = useState(2.25);
  const [plafond, setPlafond] = useState(3.5);
  const m = 1.2;
  const xs = grille(0, 6, 120);
  const lignes = {
    sans: (x: number) => x + m,
    swap: () => swap + m,
    cap: (x: number) => tx.coutAvecCap(x, strike, m, prime),
    tunnel: (x: number) => tx.coutAvecTunnel(x, plancher, Math.max(plafond, plancher), m),
  };
  const v = { sans: lignes.sans(e), swap: lignes.swap(), cap: lignes.cap(e), tunnel: lignes.tunnel(e) };
  const meilleur = (Object.entries(v) as [string, number][]).sort((a, b) => a[1] - b[1])[0][0];
  const noms: Record<string, string> = { sans: 'Sans couverture', swap: 'Swap', cap: 'Cap', tunnel: 'Tunnel' };
  return (
    <div className="outil">
      <Curseur libelle="Euribor 3 mois constaté" valeur={e} min={0} max={6} pas={0.05} affiche={pc(e)} onChange={setE} />
      <Graphe titre="Taux payé par l'emprunteur selon l'Euribor" x={[0, 6]} xFormat={(x) => `${nf(x)} %`} yFormat={(y) => `${nf(y, 1)} %`}
        series={[{ points: xs.map((x) => [x, lignes.sans(x)]), classe: 'c1' }, { points: xs.map((x) => [x, lignes.swap()]), classe: 'ok' }, { points: xs.map((x) => [x, lignes.cap(x)]) }, { points: xs.map((x) => [x, lignes.tunnel(x)]), classe: 'c2', pointille: true }]}
        verticales={[{ x: e }]} />
      <Legende items={[{ nom: 'Sans couverture', classe: 'c1' }, { nom: 'Swap', classe: 'ok' }, { nom: 'Cap' }, { nom: 'Tunnel', classe: 'c2', pointille: true }]} />
      <table className="grecques">
        <tbody>{(Object.keys(v) as (keyof typeof v)[]).map((k) => <tr key={k}><td>{noms[k]}{k === meilleur ? ' ✓' : ''}</td><td className="n">{pc(v[k])}</td></tr>)}</tbody>
      </table>
      <details>
        <summary>Régler les couvertures</summary>
        <Curseur libelle="Taux fixe du swap" valeur={swap} min={1} max={5} pas={0.05} affiche={pc(swap)} onChange={setSwap} />
        <Curseur libelle="Strike du cap" valeur={strike} min={1} max={5} pas={0.05} affiche={pc(strike)} onChange={setStrike} />
        <Curseur libelle="Prime du cap (par an)" valeur={prime} min={0} max={1} pas={0.05} affiche={pc(prime)} onChange={setPrime} />
        <Curseur libelle="Plancher du tunnel" valeur={plancher} min={0} max={4} pas={0.05} affiche={pc(plancher)} onChange={setPlancher} />
        <Curseur libelle="Plafond du tunnel" valeur={plafond} min={1} max={6} pas={0.05} affiche={pc(plafond)} onChange={setPlafond} />
      </details>
      <p className="verdict">
        Le <b>swap</b> fige le coût quoi qu'il arrive. Le <b>cap</b> plafonne le coût contre une prime et garde toute la baisse. Le <b>tunnel</b> ne coûte pas de prime mais renonce à la baisse sous le plancher. Avec un Euribor à {pc(e)}, la solution la moins chère après coup est : <b>{noms[meilleur]}</b>. Personne ne la connaît à l'avance : on choisit selon le besoin du client (budget fixe, prime acceptable, envie de garder la baisse).
      </p>
      <p className="note">Exemple fictif : crédit à Euribor 3 mois + 1,20 %. Swap 3,00 % ; cap 3,25 % pour 0,30 % par an ; tunnel 2,25 % – 3,50 % à prime nulle.</p>
    </div>
  );
}
