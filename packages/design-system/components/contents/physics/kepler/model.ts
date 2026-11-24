import { Match, Schema } from "effect";

const OrbitingBodySchema = Schema.Literals([
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "comet",
]);

export type OrbitingBody = typeof OrbitingBodySchema.Type;

const KeplerReadingSchema = Schema.Struct({
  aphelionAu: Schema.Finite,
  keplerRatio: Schema.Finite,
  perihelionAu: Schema.Finite,
  periodYears: Schema.Finite,
  semiMajorAu: Schema.Finite,
  speedRatio: Schema.Finite,
});

function semiMajorFor(body: OrbitingBody): number {
  return Match.value(body).pipe(
    Match.when("mercury", () => 0.39),
    Match.when("venus", () => 0.72),
    Match.when("earth", () => 1.0),
    Match.when("mars", () => 1.52),
    Match.when("jupiter", () => 5.2),
    Match.when("comet", () => 3.4),
    Match.exhaustive
  );
}

/** Evaluate Kepler's three laws for a heliocentric body and eccentricity e in [0, 0.85]. */
export function evaluateKepler(
  body: OrbitingBody,
  eccentricity: number
): typeof KeplerReadingSchema.Type {
  const e = Math.min(0.85, Math.max(0, eccentricity));
  const a = semiMajorFor(body);
  const periodYears = a ** 1.5;
  const keplerRatio = (periodYears * periodYears) / (a * a * a);
  const perihelionAu = a * (1 - e);
  const aphelionAu = a * (1 + e);
  const speedRatio = (1 + e) / (1 - e);
  return {
    aphelionAu,
    keplerRatio,
    perihelionAu,
    periodYears,
    semiMajorAu: a,
    speedRatio,
  };
}
