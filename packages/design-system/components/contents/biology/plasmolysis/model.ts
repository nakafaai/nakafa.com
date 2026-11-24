import { Match, Schema } from "effect";

const CellKindSchema = Schema.Literals(["plant", "redBlood"]);

export type CellKind = typeof CellKindSchema.Type;

const TonicitySchema = Schema.Literals(["hypotonic", "isotonic", "hypertonic"]);

export type Tonicity = typeof TonicitySchema.Type;

const CellOutcomeSchema = Schema.Literals([
  "turgid",
  "plasmolysed",
  "haemolysed",
  "crenated",
  "normal",
]);

export type CellOutcome = typeof CellOutcomeSchema.Type;

const PlasmolysisReadingSchema = Schema.Struct({
  innerScale: Schema.Finite,
  outcome: CellOutcomeSchema,
  waterNet: Schema.Literals(["in", "balanced", "out"]),
});

/** Evaluate osmotic outcome, protoplast/cell volume scale, and net water movement. */
export function evaluatePlasmolysis(
  cell: CellKind,
  solution: Tonicity
): typeof PlasmolysisReadingSchema.Type {
  return Match.value(solution).pipe(
    Match.when("hypotonic", () =>
      Match.value(cell).pipe(
        Match.when("plant", () => ({
          innerScale: 1.06,
          outcome: "turgid" as const,
          waterNet: "in" as const,
        })),
        Match.when("redBlood", () => ({
          innerScale: 1.24,
          outcome: "haemolysed" as const,
          waterNet: "in" as const,
        })),
        Match.exhaustive
      )
    ),
    Match.when("isotonic", () => ({
      innerScale: 0.94,
      outcome: "normal" as const,
      waterNet: "balanced" as const,
    })),
    Match.when("hypertonic", () =>
      Match.value(cell).pipe(
        Match.when("plant", () => ({
          innerScale: 0.56,
          outcome: "plasmolysed" as const,
          waterNet: "out" as const,
        })),
        Match.when("redBlood", () => ({
          innerScale: 0.56,
          outcome: "crenated" as const,
          waterNet: "out" as const,
        })),
        Match.exhaustive
      )
    ),
    Match.exhaustive
  );
}
