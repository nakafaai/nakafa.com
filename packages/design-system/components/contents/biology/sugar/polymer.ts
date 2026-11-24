import { Array as Arr, Match, Schema } from "effect";

export const SUGARS = ["maltose", "sucrose", "lactose"] as const;
export const POLYSACCHARIDES = ["starch", "glycogen", "cellulose"] as const;
const MONOMERS = ["glucose", "fructose", "galactose"] as const;
export const REACTIONS = ["condensation", "hydrolysis"] as const;
export const SCALES = ["pair", "chain"] as const;

const SugarSchema = Schema.Literals(SUGARS);
const PolysaccharideSchema = Schema.Literals(POLYSACCHARIDES);
const MonomerSchema = Schema.Literals(MONOMERS);
const ReactionSchema = Schema.Literals(REACTIONS);
const ScaleSchema = Schema.Literals(SCALES);

export type Sugar = typeof SugarSchema.Type;
export type Polysaccharide = typeof PolysaccharideSchema.Type;
export type Monomer = typeof MonomerSchema.Type;
export type Reaction = typeof ReactionSchema.Type;
export type Scale = typeof ScaleSchema.Type;

const ChainNodeSchema = Schema.Struct({
  branch: Schema.Boolean,
  id: Schema.String,
  position: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
  row: Schema.Finite,
});

type ChainNode = typeof ChainNodeSchema.Type;

/** The two monosaccharides that join to form each disaccharide. */
export function monomersOf(sugar: Sugar): readonly [Monomer, Monomer] {
  return Match.value(sugar).pipe(
    Match.when("maltose", () => ["glucose", "glucose"] as const),
    Match.when("sucrose", () => ["glucose", "fructose"] as const),
    Match.when("lactose", () => ["glucose", "galactose"] as const),
    Match.exhaustive
  );
}

/** Number of glycosidic bonds (and water molecules released/used) for `units` monomers. */
export function bondCount(units: number): number {
  return Math.max(0, Math.round(units) - 1);
}

/**
 * 3D ring coordinates for `units` glucose monomers in a polysaccharide:
 * helical coil for starch, branched tree for glycogen, and two parallel
 * straight chains for cellulose.
 */
export function chainNodes(
  polysaccharide: Polysaccharide,
  units: number
): readonly ChainNode[] {
  const count = Math.max(2, Math.round(units));
  return Match.value(polysaccharide).pipe(
    Match.when("starch", () =>
      Arr.makeBy(count, (index) => {
        const angle = index * 0.78;
        const x = -0.8 + (index / Math.max(1, count - 1)) * 1.6;
        return {
          branch: false,
          id: `starch-${index}`,
          position: [
            x,
            0.55 + Math.sin(angle) * 0.24,
            Math.cos(angle) * 0.24,
          ] as const,
          row: 0,
        };
      })
    ),
    Match.when("glycogen", () =>
      Arr.makeBy(count, (index) => {
        const isBranch = index > 2 && index % 4 === 0;
        const mainIndex = Math.floor((index * 3) / 4);
        const x = -0.82 + (mainIndex / Math.max(1, count - 1)) * 1.7;
        const y = isBranch ? 0.84 : 0.48 + Math.sin(index * 0.6) * 0.08;
        let z = 0;
        if (isBranch) {
          z = index % 8 === 0 ? 0.22 : -0.22;
        }
        return {
          branch: isBranch,
          id: `glycogen-${index}`,
          position: [x, y, z] as const,
          row: isBranch ? 1 : 0,
        };
      })
    ),
    Match.when("cellulose", () => {
      const half = Math.ceil(count / 2);
      return Arr.makeBy(count, (index) => {
        const row = index < half ? 0 : 1;
        const col = row === 0 ? index : index - half;
        const span = Math.max(1, half - 1);
        const x = -0.78 + (col / span) * 1.56;
        return {
          branch: false,
          id: `cellulose-${index}`,
          position: [x, row === 0 ? 0.72 : 0.36, 0] as const,
          row,
        };
      });
    }),
    Match.exhaustive
  );
}
