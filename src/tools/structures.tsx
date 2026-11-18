// Outils du module 5 : capital garanti (zéro-coupon + call), autocall et Phoenix date par date.
import { useState } from 'react';
import { bs } from '../finance/options';
import * as st from '../finance/structures';
import { facteurActualisation } from '../finance/taux';
import { nf } from '../lib';
import { Choix, Curseur, grille } from './commun';
import { Graphe, Legende, type Marqueur } from './graphe';

const pc = (v: number, d = 1) => `${nf(v, d)} %`;

/* ---------- 1. Capital garanti ---------- */
export function CapitalGaranti() {
  const [taux, setTaux] = useState(3);
  const [annees, setAnnees] = useState(5);
  const [vol, setVol] = useState(0.18);
  const [div, setDiv] = useState(0.03);
  const [marges, setMarges] = useState(2);
  const [protection, setProtection] = useState<'100' | '95' | '90'>('100');
  const prot = Number(protection);
  const zc = prot * facteurActualisation(taux, annees);
  const call = bs('call', { S: 100, K: 100, T: annees, r: Math.log(1 + taux / 100), sigma: vol, q: div }).prix;
  const budget = 100 - zc - marges;
  const part = st.participation(taux, annees, call, marges, prot);
  const xs = grille(40, 180, 70);
  const blocs = [
    { nom: `Zéro-coupon (garantit ${prot})`, v: zc, cls: '' },
    { nom: 'Marges et frais', v: marges, cls: 'c1' },
    { nom: 'Budget pour le call', v: Math.max(budget, 0), cls: 'ok' },
  ];
  return (
    <div className="outil">
      <Curseur libelle="Taux zéro-coupon" valeur={taux} min={-0.5} max={6} pas={0.25} affiche={pc(taux, 2)} onChange={setTaux} />
      <Curseur libelle="Maturité" valeur={annees} min={2} max={10} pas={1} affiche={`${annees} ans`} onChange={setAnnees} />
      <Curseur libelle="Volatilité de l'indice" valeur={vol} min={0.08} max={0.4} pas={0.01} affiche={pc(vol * 100, 0)} onChange={setVol} />
      <Curseur libelle="Dividendes de l'indice" valeur={div} min={0} max={0.05} pas={0.005} affiche={pc(div * 100)} onChange={setDiv} />
      <Curseur libelle="Marges et frais (total)" valeur={marges} min={0} max={5} pas={0.25} affiche={pc(marges, 2)} onChange={setMarges} />
      <Choix label="Protection du capital" valeur={protection} onChange={setProtection} options={[['100', '100 %'], ['95', '95 %'], ['90', '90 %']]} />
      <div className="barres">
        {blocs.map((b) => <div key={b.nom}><span>{b.nom}</span><i style={{ width: `${b.v}%` }} className={b.cls} /><span className="n">{nf(b.v, 2)}</span></div>)}
      </div>
      <div className="duo">
        <div><small>Prix du call à la monnaie</small><b>{nf(call, 2)}</b><em>pour 100 de nominal (Black-Scholes)</em></div>
        <div className={part > 50 ? 'bien' : part < 25 ? 'mal' : ''}><small>Participation à la hausse</small><b>{budget > 0 ? pc(part, 0) : 'impossible'}</b><em>budget {nf(budget, 2)} ÷ prix du call</em></div>
      </div>
      {budget > 0 && (
        <>
          <Graphe titre="Remboursement à l'échéance selon le niveau final de l'indice" x={[40, 180]} xFormat={(v) => `${nf(v)} %`}
            series={[{ points: xs.map((v) => [v, v]), classe: 'c1', pointille: true }, { points: xs.map((v) => [v, st.rembourseCapitalGaranti(part, v, prot)]), classe: 'ok' }]} horizontales={[{ y: 100 }]} />
          <Legende items={[{ nom: 'Indice détenu directement (hors dividendes)', classe: 'c1', pointille: true }, { nom: 'Capital garanti', classe: 'ok' }]} />
        </>
      )}
      <p className="verdict">
        {budget <= 0 ? <>Le zéro-coupon et les marges coûtent plus de 100 : impossible de construire le produit. C'est ce qui s'est passé avec les taux négatifs.</>
          : <>Plus les taux sont <b>hauts</b>, moins le zéro-coupon coûte, plus il reste pour le call. Plus la <b>volatilité</b> est forte, plus le call est cher, moins la participation est élevée. Des <b>dividendes</b> élevés rendent le call moins cher. Baisser la protection à 90 % libère du budget, au prix d'un risque de perte de 10 %.</>}
      </p>
      <p className="note">Exemple fictif. Call européen à la monnaie sur l'indice, taux continu équivalent, sans risque de crédit de l'émetteur.</p>
    </div>
  );
}

/* ---------- 2. Autocall et Phoenix, date par date ---------- */
type Produit = 'athena' | 'phoenix' | 'phoenix-sans';
const SCENARIOS: Record<string, { nom: string; niveaux: number[] }> = {
  a: { nom: 'Hausse rapide', niveaux: [95, 104, 110, 112, 115] },
  b: { nom: 'Baisse modérée', niveaux: [90, 85, 80, 78, 75] },
  c: { nom: 'Krach', niveaux: [90, 80, 70, 60, 52] },
  d: { nom: 'Montagnes russes', niveaux: [90, 65, 80, 102, 95] },
};
export function Autocall() {
  const [produit, setProduit] = useState<Produit>('athena');
  const [scen, setScen] = useState('a');
  const [niveaux, setNiveaux] = useState(SCENARIOS.a.niveaux);
  const [coupon, setCoupon] = useState(7);
  const [date, setDate] = useState(0);
  const barCoupon = produit === 'athena' ? 100 : 70;
  const r = st.phoenix(niveaux, coupon, barCoupon, 100, 60, produit !== 'phoenix-sans');
  const visible = Math.min(date, r.fin);
  const fini = date >= r.fin;
  const points: [number, number][] = [[0, 100], ...niveaux.slice(0, visible).map((n, i) => [i + 1, n] as [number, number])];
  const marqueurs: Marqueur[] = niveaux.slice(0, visible).map((n, i) => ({ x: i + 1, y: n, classe: r.flux[i] > 0 ? 'pt-vert' : 'pt-rouge' }));
  const choisirScen = (k: string) => { setScen(k); setNiveaux(SCENARIOS[k].niveaux); setDate(0); };
  const recu = r.flux.slice(0, visible).reduce((a, b) => a + b, 0);
  const n = date >= 1 && date <= r.fin ? niveaux[date - 1] : null;
  const f = date >= 1 && date <= r.fin ? r.flux[date - 1] : 0;
  let lecture = '';
  if (date === 0) lecture = `Le produit démarre : l'indice vaut 100 % de son niveau initial. Une observation par an pendant 5 ans. Appuie sur « Date suivante ».`;
  else if (n !== null) {
    const derniere = date === niveaux.length;
    if (date === r.fin && r.rappel) lecture = `Année ${date} : l'indice est à ${n} %, au-dessus de 100 %. Rappel anticipé : le client reçoit 100 + ${nf(f - 100)} de coupon(s) = ${nf(f)}. Le produit s'arrête.`;
    else if (derniere) lecture = `Échéance : l'indice est à ${n} %. ${n >= 60 ? `Au-dessus de la barrière de 60 % : capital remboursé${f > 100 ? ` avec ${nf(f - 100)} de coupon(s)` : ''}, soit ${nf(f)}.` : `Sous la barrière de 60 % : le client perd comme l'indice et reçoit ${nf(f)}.`}`;
    else if (f > 0) lecture = `Année ${date} : l'indice est à ${n} %, au-dessus de la barrière de coupon (${barCoupon} %) mais sous 100 % : coupon de ${nf(f)}${f > coupon ? ' (dont coupons rattrapés grâce à la mémoire)' : ''}, pas de rappel.`;
    else lecture = `Année ${date} : l'indice est à ${n} %, sous ${barCoupon} % : pas de coupon${produit === 'phoenix-sans' ? ', il est perdu' : produit === 'phoenix' ? ', il est mis en mémoire' : ''}, pas de rappel. Le produit continue.`;
  }
  return (
    <div className="outil">
      <Choix label="Produit" valeur={produit} onChange={(v) => { setProduit(v); setDate(0); }} options={[['athena', 'Athena'], ['phoenix', 'Phoenix mémoire'], ['phoenix-sans', 'Phoenix sans mémoire']]} />
      <Choix label="Scénario" valeur={scen} onChange={choisirScen} options={Object.entries(SCENARIOS).map(([k, s]) => [k, s.nom] as [string, string])} />
      <Curseur libelle="Coupon par an" valeur={coupon} min={3} max={12} pas={0.5} affiche={pc(coupon)} onChange={(v) => { setCoupon(v); setDate(0); }} />
      <Graphe titre="Niveau de l'indice à chaque date d'observation" x={[0, 5]} y={[30, 130]} xFormat={(v) => (v === 0 ? 'départ' : `an ${nf(v)}`)} xTicks={[0, 1, 2, 3, 4, 5]} yFormat={(v) => `${nf(v)} %`}
        series={[{ points }]} marqueurs={marqueurs}
        horizontales={[{ y: 100, label: 'rappel 100 %', classe: 'cible' }, ...(barCoupon < 100 ? [{ y: barCoupon, label: `coupon ${barCoupon} %` }] : []), { y: 60, label: 'barrière capital 60 %', classe: 'repere' }]} />
      <div className="ligne">
        <button className="btn y" disabled={fini} onClick={() => setDate(date + 1)}>Date suivante</button>
        <button className="btn g" onClick={() => setDate(0)}>Recommencer</button>
      </div>
      <p className="verdict">{lecture}</p>
      <table className="grecques">
        <thead><tr><th>Année</th><th>Indice</th><th>Versé</th></tr></thead>
        <tbody>{r.flux.slice(0, visible).map((v, i) => <tr key={i}><td>{i + 1}</td><td className="n">{niveaux[i]} %</td><td className="n">{nf(v, 1)}</td></tr>)}</tbody>
      </table>
      {fini && <p className="verdict">Total reçu : <b>{nf(r.total, 1)}</b> pour 100 investis, en {r.fin} an{r.fin > 1 ? 's' : ''}{r.total > 100 ? `, soit ${nf(st.rendementAnnuel(r.total, 100, r.fin), 2)} % par an (hors réinvestissement des coupons intermédiaires)` : ''}.</p>}
      <details>
        <summary>Modifier la trajectoire</summary>
        {niveaux.map((v, i) => <Curseur key={i} libelle={`Indice, année ${i + 1}`} valeur={v} min={30} max={130} pas={1} affiche={`${v} %`} onChange={(x) => { const c = [...niveaux]; c[i] = x; setNiveaux(c); setDate(0); }} />)}
      </details>
      <p className="note">Exemple fictif. Athena : coupon versé seulement au rappel (un coupon par année écoulée). Phoenix : coupon chaque année si l'indice est au-dessus de 70 %. Rappel si l'indice est au-dessus de 100 % ; barrière de capital à 60 %, observée seulement à l'échéance.</p>
    </div>
  );
}
