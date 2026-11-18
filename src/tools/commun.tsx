// Petits composants partagés par les outils des modules 3 à 5.
export function Curseur(p: { libelle: string; valeur: number; min: number; max: number; pas: number; affiche: string; onChange: (v: number) => void }) {
  return (
    <label className="curseur">
      <span>{p.libelle}<output>{p.affiche}</output></span>
      <input type="range" min={p.min} max={p.max} step={p.pas} value={p.valeur} onChange={(e) => p.onChange(Number(e.target.value))} />
    </label>
  );
}

export function Choix<T extends string>({ valeur, options, onChange, label }: { valeur: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, l]) => <button key={v} aria-pressed={valeur === v} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}

export const grille = (a: number, b: number, n = 80) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
