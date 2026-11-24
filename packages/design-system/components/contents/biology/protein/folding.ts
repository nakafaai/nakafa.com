import { Array as Arr, Match, Schema } from "effect";

export const LEVELS = [
  "primary",
  "secondary",
  "tertiary",
  "quaternary",
] as const;
export const CONDITIONS = ["normal", "heated", "acid"] as const;
const BONDS = ["peptide", "hydrogen", "ionic", "hydrophobic"] as const;

const LevelSchema = Schema.Literals(LEVELS);
const ConditionSchema = Schema.Literals(CONDITIONS);
const BondSchema = Schema.Literals(BONDS);

export type Level = typeof LevelSchema.Type;
export type Condition = typeof ConditionSchema.Type;
export type Bond = typeof BondSchema.Type;

const BeadSchema = Schema.Struct({
  id: Schema.String,
  position: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
  subunit: Schema.Finite,
});

type Bead = typeof BeadSchema.Type;

/**
 * Which bonds hold the protein in the active `(level, condition)`: heat and
 * acid disrupt weak hydrogen, ionic, and hydrophobic interactions while
 * leaving covalent peptide bonds intact.
 */
export function activeBonds(
  level: Level,
  condition: Condition
): readonly Bond[] {
  if (condition !== "normal") {
    return ["peptide"];
  }
  return Match.value(level).pipe(
    Match.when("primary", () => ["peptide"] as const),
    Match.when("secondary", () => ["peptide", "hydrogen"] as const),
    Match.when(
      "tertiary",
      () => ["peptide", "hydrogen", "ionic", "hydrophobic"] as const
    ),
    Match.when(
      "quaternary",
      () => ["peptide", "hydrogen", "ionic", "hydrophobic"] as const
    ),
    Match.exhaustive
  );
}

/** Whether the polypeptide is folded into an active biological shape. */
export function isWorking(level: Level, condition: Condition): boolean {
  return (
    condition === "normal" && (level === "tertiary" || level === "quaternary")
  );
}

/** 3D amino-acid bead coordinates for each folding level and denaturation state. */
export function polypeptideBeads(
  level: Level,
  condition: Condition
): readonly Bead[] {
  if (condition !== "normal") {
    return Arr.makeBy(18, (index) => {
      const t = index / 17;
      return {
        id: `denatured-${index}`,
        position: [
          -0.85 + t * 1.7,
          0.5 + Math.sin(index * 1.3) * 0.14,
          Math.cos(index * 1.1) * 0.16,
        ],
        subunit: 0,
      };
    });
  }
  return Match.value(level).pipe(
    Match.when("primary", () =>
      Arr.makeBy(16, (index) => ({
        id: `primary-${index}`,
        position: [-0.82 + (index / 15) * 1.64, 0.56, 0] as const,
        subunit: 0,
      }))
    ),
    Match.when("secondary", () =>
      Arr.makeBy(18, (index) => {
        if (index < 10) {
          const angle = index * 1.05;
          return {
            id: `helix-${index}`,
            position: [
              -0.78 + index * 0.085,
              0.58 + Math.sin(angle) * 0.16,
              Math.cos(angle) * 0.16,
            ] as const,
            subunit: 0,
          };
        }
        const sheetIndex = index - 10;
        const zigzag = sheetIndex % 2 === 0 ? 0.12 : -0.12;
        return {
          id: `sheet-${index}`,
          position: [0.16 + sheetIndex * 0.1, 0.56 + zigzag, 0] as const,
          subunit: 1,
        };
      })
    ),
    Match.when("tertiary", () =>
      Arr.makeBy(20, (index) => {
        const angle = index * 0.85;
        const r = 0.24 + 0.08 * Math.sin(index * 1.7);
        return {
          id: `tertiary-${index}`,
          position: [
            Math.cos(angle) * r,
            0.58 + Math.sin(angle * 0.6) * 0.24,
            Math.sin(angle) * r,
          ] as const,
          subunit: 0,
        };
      })
    ),
    Match.when("quaternary", () => {
      const centres: readonly (readonly [number, number, number])[] = [
        [-0.32, 0.78, 0.12],
        [0.32, 0.78, -0.12],
        [-0.32, 0.36, -0.12],
        [0.32, 0.36, 0.12],
      ];
      return Arr.flatMap(centres, ([cx, cy, cz], subunit) =>
        Arr.makeBy(8, (index) => {
          const angle = index * 0.9;
          return {
            id: `quat-${subunit}-${index}`,
            position: [
              cx + Math.cos(angle) * 0.16,
              cy + Math.sin(angle * 0.7) * 0.14,
              cz + Math.sin(angle) * 0.16,
            ] as const,
            subunit,
          };
        })
      );
    }),
    Match.exhaustive
  );
}
