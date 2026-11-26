import { Match, Schema } from "effect";

const PeriodOxideSchema = Schema.Literals([
  "na2o",
  "mgo",
  "al2o3",
  "sio2",
  "p4o10",
  "so2",
]);

export type PeriodOxide = typeof PeriodOxideSchema.Type;

const OxideProfileSchema = Schema.Struct({
  nature: Schema.Literals(["basic", "amphoteric", "acidic"]),
  ph: Schema.Finite,
  structure: Schema.Literals(["ionic", "giantCovalent", "molecular"]),
});

/** Evaluate Period 3 oxide solution pH, acid-base character, and bonding lattice. */
export function evaluatePeriodOxide(
  oxide: PeriodOxide
): typeof OxideProfileSchema.Type {
  return Match.value(oxide).pipe(
    Match.when("na2o", () => ({
      nature: "basic" as const,
      ph: 13.5,
      structure: "ionic" as const,
    })),
    Match.when("mgo", () => ({
      nature: "basic" as const,
      ph: 9.5,
      structure: "ionic" as const,
    })),
    Match.when("al2o3", () => ({
      nature: "amphoteric" as const,
      ph: 7,
      structure: "ionic" as const,
    })),
    Match.when("sio2", () => ({
      nature: "acidic" as const,
      ph: 7,
      structure: "giantCovalent" as const,
    })),
    Match.when("p4o10", () => ({
      nature: "acidic" as const,
      ph: 2,
      structure: "molecular" as const,
    })),
    Match.when("so2", () => ({
      nature: "acidic" as const,
      ph: 2.5,
      structure: "molecular" as const,
    })),
    Match.exhaustive
  );
}
