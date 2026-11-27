import { chanceAt } from "@repo/design-system/components/three/field/noise";
import { Array as Arr, Schema } from "effect";

/**
 * How many numbers place one cell of a block of tissue: where its middle
 * is, how wide, tall and deep it is, and a tone of its own.
 */
export const BLOB_STRIDE = 7;

/**
 * A block cut out of a leaf blade, its upper face up and its cut face to
 * +z: how wide and deep the block is, how thick the vein that runs through
 * its middle is, where along its lower face a stoma opens and which block it
 * is.
 */
export const LaminaSchema = Schema.Struct({
  depth: Schema.Finite,
  seed: Schema.Int,
  stoma: Schema.Finite,
  vein: Schema.Finite,
  width: Schema.Finite,
});
export type Lamina = typeof LaminaSchema.Type;

/** The heights at which the layers of the blade begin, from its lower face up, and the height of the vein's middle. */
export const LAYERS = {
  cuticle: 1.15,
  lower: 0.1,
  palisade: 0.62,
  spongy: 0.24,
  top: 1.19,
  upper: 1,
  vein: 0.56,
} as const;

/** Where the xylem vessels of a vein lie in its upper half, as shares of its radius, and how wide each is. */
const XYLEM = [
  [-0.34, 0.3, 0.3],
  [0, 0.44, 0.34],
  [0.34, 0.3, 0.3],
  [-0.17, 0.08, 0.24],
  [0.17, 0.08, 0.24],
] as const;

/** Where the phloem cells of a vein lie in its lower half, as shares of its radius, and how wide each is. */
const PHLOEM = [
  [-0.36, -0.2, 0.17],
  [-0.12, -0.22, 0.17],
  [0.12, -0.22, 0.17],
  [0.36, -0.2, 0.17],
  [-0.24, -0.41, 0.16],
  [0, -0.43, 0.16],
  [0.24, -0.41, 0.16],
  [-0.1, -0.6, 0.14],
  [0.1, -0.6, 0.14],
] as const;

/**
 * One sheet of the epidermis between two heights: rows of pavement cells
 * with no two walls in line, and, in the row at the cut face of the lower
 * sheet, a gap where the stoma sits.
 */
function sheet(lamina: Lamina, from: number, to: number, pierced: boolean) {
  const rows = 5;
  const across = 12;
  const edge = (row: number, step: number) =>
    step === 0 || step === across
      ? (step / across - 0.5) * lamina.width
      : ((step + 0.7 * (chanceAt(step, row, lamina.seed) - 0.5)) / across -
          0.5) *
        lamina.width;
  return Arr.flatMap(Arr.range(0, rows - 1), (row) =>
    Arr.flatMap(Arr.range(0, across - 1), (step) => {
      const left = edge(row, step);
      const right = edge(row, step + 1);
      const middle = (left + right) / 2;
      const open =
        pierced && row === rows - 1 && Math.abs(middle - lamina.stoma) < 0.1;
      return open
        ? []
        : [
            middle,
            (from + to) / 2,
            ((row + 0.5) / rows - 0.5) * lamina.depth,
            (right - left) * 0.97,
            to - from,
            (lamina.depth / rows) * 0.97,
            chanceAt(step, row, lamina.seed + 3),
          ];
    })
  );
}

/** How high the vein and its sheath stand at `x` across the block, or the floor of the palisade where no vein runs. */
function veinTop(lamina: Lamina, x: number) {
  return Math.abs(x) < lamina.vein
    ? LAYERS.vein + Math.sqrt(lamina.vein ** 2 - x ** 2) + 0.03
    : LAYERS.palisade;
}

/**
 * The palisade mesophyll: tall cells standing on end under the upper
 * epidermis, packed like a honeycomb seen from above, shorter where the vein
 * rises into them.
 */
function palisade(lamina: Lamina) {
  const across = 17;
  const rows = 7;
  const wide = lamina.width / (across + 0.5);
  return Arr.flatMap(Arr.range(0, rows - 1), (row) =>
    Arr.flatMap(Arr.range(0, across - 1), (column) => {
      const chance = chanceAt(column, row, lamina.seed + 5);
      const x = (column + 0.5 + 0.5 * (row % 2)) * wide - lamina.width / 2;
      const floor = Math.max(
        veinTop(lamina, x),
        LAYERS.palisade + 0.05 * (chance - 0.5)
      );
      const top = LAYERS.upper - 0.004;
      return top - floor < 0.09
        ? []
        : [
            x,
            (top + floor) / 2,
            ((row + 0.5) / rows - 0.5) * lamina.depth,
            wide * 0.92,
            top - floor,
            (lamina.depth / rows) * 0.92,
            chance,
          ];
    })
  );
}

/**
 * The spongy mesophyll: rounded cells of every shape, loosely joined, with
 * air between them, none where the vein runs and none in the chamber above
 * the stoma, where the air of the leaf meets the air outside.
 */
function spongy(lamina: Lamina) {
  const across = 13;
  const tiers = 3;
  const rows = 6;
  const span = [
    lamina.width / across,
    (LAYERS.palisade - LAYERS.spongy) / tiers,
    lamina.depth / rows,
  ] as const;
  return Arr.flatMap(Arr.range(0, across * tiers * rows - 1), (cell) => {
    const toss = (salt: number) => chanceAt(cell, salt, lamina.seed + 7);
    const column = cell % across;
    const tier = Math.floor(cell / across) % tiers;
    const row = Math.floor(cell / across / tiers);
    const x =
      (column + 0.5 + 0.7 * (toss(1) - 0.5)) * span[0] - lamina.width / 2;
    const y = LAYERS.spongy + (tier + 0.5 + 0.5 * (toss(2) - 0.5)) * span[1];
    const z = (row + 0.5 + 0.7 * (toss(3) - 0.5)) * span[2] - lamina.depth / 2;
    const inVein = Math.hypot(x, y - LAYERS.vein) < lamina.vein + 0.07;
    const inChamber =
      Math.abs(x - lamina.stoma) < 0.13 &&
      y < LAYERS.spongy + 0.17 &&
      z > lamina.depth / 2 - 0.3;
    return toss(4) < 0.3 || inVein || inChamber
      ? []
      : [
          x,
          y,
          z,
          span[0] * (0.78 + 0.5 * toss(5)),
          span[1] * (0.8 + 0.4 * toss(6)),
          span[2] * (0.78 + 0.5 * toss(7)),
          toss(8),
        ];
  });
}

/**
 * The cells of a vein that run the depth of the block, each from its place
 * and width as shares of the vein's radius. `bore` is the share of that
 * width drawn: 1 for the cell and its wall, less for the open bore inside a
 * vessel, which reaches a little further out of the cut face so it shows.
 */
function strands(
  lamina: Lamina,
  cells: readonly (readonly [number, number, number])[],
  bore: number
) {
  const poke = (1.2 - bore) * 0.01;
  return Arr.flatMap(cells, ([x, y, wide], index) => [
    x * lamina.vein,
    LAYERS.vein + y * lamina.vein,
    poke / 2,
    wide * lamina.vein * bore,
    wide * lamina.vein * bore,
    lamina.depth + poke,
    chanceAt(index, 1, lamina.seed + 9),
  ]);
}

/**
 * The chloroplasts of some cells, `each` to a cell: small green lenses that
 * lie against the wall of the cell, where the light reaches them.
 */
function plastids(cells: readonly number[], each: number, seed: number) {
  return Arr.flatMap(Arr.chunksOf(cells, BLOB_STRIDE), (cell, index) =>
    Arr.flatMap(Arr.range(0, each - 1), (plastid) => {
      const turn = chanceAt(index, plastid, seed) * 2 * Math.PI;
      return [
        Number(cell[0]) + Math.cos(turn) * Number(cell[3]) * 0.4,
        Number(cell[1]) +
          (chanceAt(index, plastid, seed + 1) - 0.5) * Number(cell[4]) * 0.78,
        Number(cell[2]) + Math.sin(turn) * Number(cell[5]) * 0.4,
        0.03,
        0.022,
        0.03,
        chanceAt(index, plastid, seed + 2),
      ];
    })
  );
}

/**
 * Every cell of a block of leaf blade, layer by layer, as `BLOB_STRIDE`
 * numbers each: the two sheets of the epidermis, the palisade and the spongy
 * mesophyll with their chloroplasts, the vein with its sheath, its xylem
 * vessels (and their open bores) above its phloem, and the pair of guard
 * cells around the stoma in the lower face.
 */
export function growLamina(lamina: Lamina) {
  const columns = palisade(lamina);
  const sponge = spongy(lamina);
  const front = lamina.depth / 2 - 0.1;
  const guards = [
    ...[lamina.stoma - 0.052, 0.168, front, 0.085, 0.125, 0.2, 0.3],
    ...[lamina.stoma + 0.052, 0.168, front, 0.085, 0.125, 0.2, 0.7],
  ];
  return {
    bores: strands(lamina, XYLEM, 0.6),
    guards,
    lower: sheet(lamina, LAYERS.lower, LAYERS.spongy, true),
    palisade: columns,
    phloem: strands(lamina, PHLOEM, 1),
    plastids: [
      ...plastids(columns, 7, lamina.seed + 11),
      ...plastids(sponge, 3, lamina.seed + 13),
      ...plastids(guards, 4, lamina.seed + 15),
    ],
    sheath: Arr.flatMap(Arr.range(0, 11), (cell) => {
      const turn = (cell / 12) * 2 * Math.PI;
      return [
        Math.cos(turn) * lamina.vein * 0.84,
        LAYERS.vein + Math.sin(turn) * lamina.vein * 0.84,
        0,
        lamina.vein * 0.44,
        lamina.vein * 0.44,
        lamina.depth,
        chanceAt(cell, 2, lamina.seed + 9),
      ];
    }),
    spongy: sponge,
    upper: sheet(lamina, LAYERS.upper, LAYERS.cuticle, false),
    xylem: strands(lamina, XYLEM, 1),
  };
}
