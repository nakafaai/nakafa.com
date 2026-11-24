import { Match, Schema } from "effect";

const SEXES = ["male", "female"] as const;
const LEVELS = ["system", "gonad", "meiosis", "gamete"] as const;

const SexSchema = Schema.Literals(SEXES);
const LevelSchema = Schema.Literals(LEVELS);

export type Sex = typeof SexSchema.Type;
export type Level = typeof LevelSchema.Type;

const CellKeySchema = Schema.Literals([
  "spermatogonium",
  "primarySpermatocyte",
  "secondarySpermatocyte",
  "spermatid",
  "sperm",
  "oogonium",
  "primaryOocyte",
  "secondaryOocyte",
  "polarBody",
  "ovum",
]);

export type CellKey = typeof CellKeySchema.Type;

const DivisionStateSchema = Schema.Struct({
  cellKey: CellKeySchema,
  chromosomeCount: Schema.Finite,
  madeCount: Schema.Finite,
  polarCount: Schema.Finite,
});

type DivisionState = typeof DivisionStateSchema.Type;

/** Clamp meiosis step into [0, 3]. */
export function clampStep(step: number): number {
  return Math.max(0, Math.min(3, Math.round(step)));
}

/**
 * Cell stage, chromosome number, working gametes made, and polar bodies for a
 * given `(sex, level, step, diploid)`.
 */
export function divisionState(
  sex: Sex,
  level: Level,
  step: number,
  diploid: number
): DivisionState {
  const haploid = Math.round(diploid / 2);
  const safe = clampStep(step);
  const madeCount = sex === "male" ? 4 : 1;
  const polarCount = sex === "male" ? 0 : 3;

  if (level === "gamete") {
    return {
      cellKey: sex === "male" ? "sperm" : "ovum",
      chromosomeCount: haploid,
      madeCount,
      polarCount,
    };
  }
  if (level === "system" || level === "gonad") {
    return {
      cellKey: sex === "male" ? "spermatogonium" : "oogonium",
      chromosomeCount: diploid,
      madeCount,
      polarCount,
    };
  }
  return Match.value(sex).pipe(
    Match.when("male", () => {
      if (safe === 0) {
        return {
          cellKey: "spermatogonium" as const,
          chromosomeCount: diploid,
          madeCount,
          polarCount,
        };
      }
      if (safe === 1) {
        return {
          cellKey: "primarySpermatocyte" as const,
          chromosomeCount: diploid,
          madeCount,
          polarCount,
        };
      }
      if (safe === 2) {
        return {
          cellKey: "secondarySpermatocyte" as const,
          chromosomeCount: haploid,
          madeCount,
          polarCount,
        };
      }
      return {
        cellKey: "spermatid" as const,
        chromosomeCount: haploid,
        madeCount,
        polarCount,
      };
    }),
    Match.when("female", () => {
      if (safe === 0) {
        return {
          cellKey: "oogonium" as const,
          chromosomeCount: diploid,
          madeCount,
          polarCount,
        };
      }
      if (safe === 1) {
        return {
          cellKey: "primaryOocyte" as const,
          chromosomeCount: diploid,
          madeCount,
          polarCount,
        };
      }
      if (safe === 2) {
        return {
          cellKey: "secondaryOocyte" as const,
          chromosomeCount: haploid,
          madeCount,
          polarCount,
        };
      }
      return {
        cellKey: "ovum" as const,
        chromosomeCount: haploid,
        madeCount,
        polarCount,
      };
    }),
    Match.exhaustive
  );
}
