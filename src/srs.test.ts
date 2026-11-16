import { describe, expect, it } from 'vitest';
import { Rating, State } from 'ts-fsrs';
import { duree, evaluer, file, maitrisee } from './srs';

const t0 = new Date('2026-11-16T10:00:00Z');
const jours = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 86_400_000;

describe('répétition espacée', () => {
  it('une carte ratée revient vite, une carte facile revient tard', () => {
    const ratee = evaluer(undefined, Rating.Again, t0);
    const facile = evaluer(undefined, Rating.Easy, t0);
    expect(jours(t0, ratee.due)).toBeLessThan(1);
    expect(jours(t0, facile.due)).toBeGreaterThan(2);
  });

  it("les intervalles s'allongent quand on réussit plusieurs fois", () => {
    let c = evaluer(undefined, Rating.Good, t0);
    let maintenant = t0;
    const intervalles: number[] = [];
    for (let i = 0; i < 6; i++) {
      maintenant = new Date(c.due.getTime() + 1000);
      const suivant = evaluer(c, Rating.Good, maintenant);
      intervalles.push(jours(maintenant, suivant.due));
      c = suivant;
    }
    expect(c.state).toBe(State.Review);
    expect(intervalles[5]).toBeGreaterThan(intervalles[2]);
    expect(intervalles[5]).toBeGreaterThan(14);
  });

  it("un oubli raccourcit fortement l'intervalle", () => {
    let c = evaluer(undefined, Rating.Easy, t0);
    let maintenant = new Date(c.due.getTime() + 1000);
    c = evaluer(c, Rating.Good, maintenant);
    const long = jours(maintenant, c.due);
    maintenant = new Date(c.due.getTime() + 1000);
    const oubli = evaluer(c, Rating.Again, maintenant);
    expect(jours(maintenant, oubli.due)).toBeLessThan(long / 4);
    expect(oubli.lapses).toBe(1);
  });

  it('maîtrisée = en révision avec au moins 7 jours', () => {
    expect(maitrisee(undefined)).toBe(false);
    const ratee = evaluer(undefined, Rating.Again, t0);
    expect(maitrisee({ id: 'a', carte: ratee, echeance: ratee.due.getTime() })).toBe(false);
    const facile = evaluer(undefined, Rating.Easy, t0);
    expect(maitrisee({ id: 'a', carte: facile, echeance: facile.due.getTime() })).toBe(facile.scheduled_days >= 7);
  });

  it("la file met les cartes en retard avant les nouvelles, les plus anciennes d'abord", () => {
    const c = evaluer(undefined, Rating.Good, t0);
    const etats = new Map([
      ['b', { id: 'b', carte: c, echeance: 2000 }],
      ['a', { id: 'a', carte: c, echeance: 1000 }],
      ['futur', { id: 'futur', carte: c, echeance: 9000 }],
    ]);
    expect(file(['n1', 'b', 'futur', 'a'], etats, 5000)).toEqual(['a', 'b', 'n1']);
    expect(file(['n1', 'b', 'futur', 'a'], etats, 5000, false)).toEqual(['a', 'b']);
  });

  it('affiche les durées lisiblement', () => {
    expect(duree(5 * 60000)).toBe('5 min');
    expect(duree(3 * 3600000)).toBe('3 h');
    expect(duree(4 * 86400000)).toBe('4 j');
    expect(duree(90 * 86400000)).toBe('3 mois');
  });
});
