// Outils du module 4 : calculateur de cours à terme, couvertures de change d'un exportateur ou d'un importateur.
import { useState } from 'react';
import * as fx from '../finance/fx';
import { eur, nf } from '../lib';
import { Choix, Curseur, grille } from './commun';
import { Graphe, Legende } from './graphe';

const pc = (v: number, d = 2) => `${nf(v, d)} %`;

/* ---------- 1. Calculateur de cours à terme ---------- */
export function CoursTerme() {
  const [spot, setSpot] = useState(1.12);
  const [rEur, setREur] = useState(2.7);
  const [rUsd, setRUsd] = useState(3.9);
  const [jours, setJours] = useState(365);
  const M = 1_000_000;
  const F = fx.coursTerme(spot, rUsd, rEur, jours);
  const pts = fx.pointsTerme(spot, F);
  const usdPlaces = M / (1 + (rUsd / 100) * (jours / 360));
  const eurEmpruntes = usdPlaces / spot;
  const eurDus = eurEmpruntes * (1 + (rEur / 100) * (jours / 360));
  const etat = Math.abs(pts) < 0.5 ? 'pair' : pts > 0 ? 'report' : 'deport';
  return (
    <div className="outil">
      <Curseur libelle="EUR/USD au comptant" valeur={spot} min={0.95} max={1.3} pas={0.005} affiche={nf(spot, 4)} onChange={setSpot} />
      <Curseur libelle="Taux euro (€STR, Euribor)" valeur={rEur} min={0} max={6} pas={0.05} affiche={pc(rEur)} onChange={setREur} />
      <Curseur libelle="Taux dollar (SOFR)" valeur={rUsd} min={0} max={6} pas={0.05} affiche={pc(rUsd)} onChange={setRUsd} />
      <Curseur libelle="Durée" valeur={jours} min={30} max={720} pas={1} affiche={`${jours} jours`} onChange={setJours} />
      <div className="duo">
        <div><small>Cours à terme</small><b>{nf(F, 4)}</b><em>contre {nf(spot, 4)} au comptant</em></div>
        <div><small>Points de terme</small><b>{pts > 0 ? '+' : pts < 0 ? '−' : ''}{nf(Math.abs(pts), 1)} pips</b><em>{etat === 'report' ? 'l\'euro est en report' : etat === 'deport' ? 'l\'euro est en déport' : 'taux égaux : terme = comptant'}</em></div>
      </div>
      <Graphe titre="Cours à terme selon la durée" x={[0, 720]} xTicks={[0, 180, 360, 540, 720]} xFormat={(v) => `${nf(v)} j`} yFormat={(v) => nf(v, 3)}
        series={[{ points: grille(0, 720, 48).map((j) => [j, fx.coursTerme(spot, rUsd, rEur, j)] as [number, number]) }]}
        horizontales={[{ y: spot, label: 'comptant' }]} marqueurs={[{ x: jours, y: F }]} />
      <ol className="chaine">
        <li><b>La banque doit livrer 1 M$ dans {jours} jours.</b> Elle place aujourd'hui {nf(usdPlaces)} $ à {pc(rUsd)} : avec les intérêts, cela fera 1 M$.</li>
        <li><b>Elle achète ces dollars au comptant</b> à {nf(spot, 4)} : ils lui coûtent {eur(eurEmpruntes)}.</li>
        <li><b>Elle emprunte ces euros</b> à {pc(rEur)} : à l'échéance, elle devra rembourser {eur(eurDus)}.</li>
        <li><b>Le cours à terme sans perte ni gain</b> : 1 000 000 $ ÷ {eur(eurDus).replace(' €', '')} € = <b>{nf(F, 4)}</b>.</li>
      </ol>
      <p className="verdict">
        {etat === 'report' && <>Le taux du dollar dépasse celui de l'euro : l'euro vaut <b>plus</b> de dollars à terme qu'au comptant (report). Bon pour un importateur qui achète des dollars à terme, moins bon pour un exportateur qui les vend.</>}
        {etat === 'deport' && <>Le taux de l'euro dépasse celui du dollar : l'euro vaut <b>moins</b> de dollars à terme (déport). Bon pour un exportateur qui vend des dollars à terme, moins bon pour un importateur.</>}
        {etat === 'pair' && <>Taux égaux : rien à compenser, le terme est égal au comptant.</>}
        {' '}Ce n'est pas une prévision : le terme compense seulement l'écart de taux, sinon il y aurait un arbitrage sans risque.
      </p>
      <p className="note">Exemple fictif. Intérêts simples, base Exact/360 pour les deux devises.</p>
    </div>
  );
}

/* ---------- 2. Couvertures de change : terme, option, tunnel, terme participatif ---------- */
type Role = 'export' | 'import';
type Strat = 'terme' | 'option' | 'tunnel' | 'participatif';
const M = 1_000_000, TERME = 1.1333, PRIME = 13_000;
const P = {
  export: { strike: 1.15, bas: 1.10, haut: 1.16, garanti: 1.145 },
  import: { strike: 1.12, bas: 1.10, haut: 1.16, garanti: 1.12 },
};
function montant(role: Role, s: Strat | 'sans', x: number): number {
  const p = P[role];
  if (s === 'sans') return M / x;
  if (s === 'terme') return M / TERME;
  if (role === 'export') {
    if (s === 'option') return M / Math.min(x, p.strike) - PRIME;
    if (s === 'tunnel') return fx.exportateurTunnel(M, p.bas, p.haut, x);
    return fx.exportateurParticipatif(M, p.garanti, 50, x);
  }
  if (s === 'option') return fx.coutImportateurOption(M, p.strike, PRIME, x);
  if (s === 'tunnel') return M / Math.min(Math.max(x, p.bas), p.haut);
  return x <= p.garanti ? M / p.garanti : (0.5 * M) / p.garanti + (0.5 * M) / x;
}
const DESCR: Record<Role, Record<Strat, string>> = {
  export: {
    terme: "Vente de dollars à terme à 1,1333 : montant connu dès aujourd'hui, sans prime, mais aucun gain si l'EUR/USD baisse.",
    option: "Achat d'un call EUR / put USD de strike 1,15 pour 13 000 € : au pire 1,15, et tout le gain si l'EUR/USD baisse, moins la prime.",
    tunnel: "Tunnel 1,10 – 1,16 à prime nulle : protégé au-dessus de 1,16, gain limité sous 1,10.",
    participatif: "Terme participatif : cours garanti 1,1450 (moins bon que le terme), et 50 % du gain si l'EUR/USD finit plus bas. Prime nulle.",
  },
  import: {
    terme: "Achat de dollars à terme à 1,1333 : coût connu dès aujourd'hui, sans prime, mais aucun gain si l'EUR/USD monte.",
    option: "Achat d'un put EUR / call USD de strike 1,12 pour 13 000 € : au pire 1,12, et tout le gain si l'EUR/USD monte, plus la prime.",
    tunnel: "Tunnel 1,10 – 1,16 à prime nulle : protégé sous 1,10, gain limité au-dessus de 1,16.",
    participatif: "Terme participatif : cours garanti 1,12 (moins bon que le terme), et 50 % du gain si l'EUR/USD finit plus haut. Prime nulle.",
  },
};
export function CouverturesFx() {
  const [role, setRole] = useState<Role>('export');
  const [strat, setStrat] = useState<Strat>('terme');
  const [x, setX] = useState(1.08);
  const xs = grille(0.98, 1.3, 128);
  const couv = montant(role, strat, x), sans = montant(role, 'sans', x);
  const mieux = role === 'export' ? couv >= sans : couv <= sans;
  return (
    <div className="outil">
      <Choix label="Client" valeur={role} onChange={setRole} options={[['export', 'Exportateur (reçoit 1 M$)'], ['import', 'Importateur (paie 1 M$)']]} />
      <Choix label="Couverture" valeur={strat} onChange={setStrat} options={[['terme', 'Terme'], ['option', 'Option'], ['tunnel', 'Tunnel'], ['participatif', 'Participatif']]} />
      <Curseur libelle="EUR/USD à l'échéance" valeur={x} min={0.98} max={1.3} pas={0.005} affiche={nf(x, 3)} onChange={setX} />
      <Graphe titre={role === 'export' ? 'Euros reçus selon le cours à l’échéance' : 'Euros payés selon le cours à l’échéance'} x={[0.98, 1.3]} xFormat={(v) => nf(v, 2)} yFormat={(v) => `${nf(v / 1000)} k`}
        series={[{ points: xs.map((v) => [v, montant(role, 'sans', v)]), classe: 'c1' }, { points: xs.map((v) => [v, montant(role, strat, v)]), classe: 'ok' }]}
        verticales={[{ x }]} marqueurs={[{ x, y: couv }]} />
      <Legende items={[{ nom: 'Sans couverture', classe: 'c1' }, { nom: 'Avec la couverture choisie', classe: 'ok' }]} />
      <div className="duo">
        <div className={mieux ? 'bien' : 'mal'}><small>Avec la couverture</small><b>{eur(couv)}</b><em>{role === 'export' ? 'reçus' : 'payés'}</em></div>
        <div><small>Sans couverture</small><b>{eur(sans)}</b><em>terme : {eur(M / TERME)}</em></div>
      </div>
      <p className="verdict">{DESCR[role][strat]} {role === 'export' ? "L'exportateur craint un EUR/USD haut : ses dollars valent alors moins d'euros." : "L'importateur craint un EUR/USD bas : ses dollars lui coûtent alors plus d'euros."}</p>
      <p className="note">Exemple fictif : 1 M$ dans un an, comptant 1,12, terme 1,1333. Primes et niveaux d'exercice, pas des cotations réelles.</p>
    </div>
  );
}
