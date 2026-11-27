import type { Mesh } from "@repo/design-system/components/three/flora/limb";
import { Array as Arr, Schema } from "effect";

/** The outlines a leaf blade, a leaflet, a petal or a sepal can have. */
export const OutlineSchema = Schema.Literals([
  "cordate",
  "elliptic",
  "lanceolate",
  "linear",
  "obcordate",
  "obovate",
  "ovate",
]);
export type Outline = typeof OutlineSchema.Type;

/**
 * How an outline is drawn: where along the blade it is widest (`belly`), how
 * blunt its base and its tip are (a smaller power is blunter), how deep the
 * notch at its tip is and how far its base lobes reach back past the stalk.
 */
const OUTLINES = {
  cordate: { base: 0.32, belly: 0.3, lobe: 0.16, notch: 0, tip: 1.25 },
  elliptic: { base: 0.62, belly: 0.5, lobe: 0, notch: 0, tip: 0.62 },
  lanceolate: { base: 0.7, belly: 0.3, lobe: 0, notch: 0, tip: 1.5 },
  linear: { base: 0.22, belly: 0.4, lobe: 0, notch: 0, tip: 1.7 },
  obcordate: { base: 1.1, belly: 0.72, lobe: 0, notch: 0.16, tip: 0.3 },
  obovate: { base: 1.15, belly: 0.66, lobe: 0, notch: 0, tip: 0.42 },
  ovate: { base: 0.45, belly: 0.34, lobe: 0, notch: 0, tip: 1.1 },
};

/**
 * One flat organ of a plant, lying along +x from its stalk at the origin
 * with its upper face to +y: its outline and size, the teeth of its margin,
 * the pairs of side veins that leave its midrib, how far its two halves fold
 * up from the midrib, how far its tip arches down, how much its margin waves
 * and how deep its veins are pressed into its upper face.
 */
const BladeSchema = Schema.Struct({
  arch: Schema.Finite,
  columns: Schema.Int,
  fold: Schema.Finite,
  length: Schema.Finite,
  outline: OutlineSchema,
  relief: Schema.Finite,
  rows: Schema.Int,
  teeth: Schema.Int,
  veins: Schema.Int,
  wave: Schema.Finite,
  width: Schema.Finite,
});
export type Blade = typeof BladeSchema.Type;

/**
 * The half-width of an outline at `along` of the way from its stalk (0) to
 * its tip (1), as a share of its widest half-width: it swells from the stalk
 * to its belly and narrows to its tip, each side with its own bluntness.
 */
export function bladeWidth(outline: Outline, along: number) {
  const shape = OUTLINES[outline];
  const held = Math.min(1, Math.max(0, along));
  const rise = Math.min(1, held / shape.belly);
  const fall = Math.min(1, (1 - held) / (1 - shape.belly));
  return Math.sin((rise * Math.PI) / 2) ** shape.base * fall ** shape.tip;
}

/**
 * How strongly a vein runs under a place of a blade, from 0 between veins to
 * 1 on one: the midrib along the middle, thinning to the tip, and `veins`
 * pairs of side veins that leave it at an angle and curve toward the margin.
 * `along` runs from stalk to tip, `across` from -1 at one margin to 1 at the
 * other.
 */
export function veinAt(along: number, across: number, veins: number) {
  const reach = Math.abs(across);
  const midrib = Math.exp(-((reach / (0.1 * (1.15 - along))) ** 2));
  const phase = (along - 0.3 * reach - 0.08 * reach * reach) * veins;
  const gap = phase - Math.round(phase);
  const side = Math.exp(-((gap / 0.13) ** 2)) * (1 - reach) ** 0.4;
  return Math.max(midrib, side * 0.7);
}

/**
 * The surface of one blade: a grid of `rows` by `columns` laid inside its
 * outline, toothed at the margin, folded along the midrib, arched to the
 * tip, waved at the margin and pressed in along every vein, so the veins are
 * real relief that catches the light and not a painted line.
 */
export function bladeMesh(blade: Blade): Mesh {
  const shape = OUTLINES[blade.outline];
  const half = blade.width / 2;
  const vertices = Arr.flatMap(Arr.range(0, blade.rows), (row) => {
    const along = row / blade.rows;
    const tooth =
      1 - 0.09 * Math.sign(blade.teeth) * ((along * blade.teeth) % 1);
    const reach =
      half * Math.max(0.03, bladeWidth(blade.outline, along)) * tooth;
    return Arr.map(Arr.range(0, blade.columns), (column) => {
      const across = (2 * column) / blade.columns - 1;
      const edge = across * across;
      const notch = shape.notch * (1 - edge) * along ** 6;
      const lobe = shape.lobe * edge * (1 - along) ** 5;
      const lift = blade.fold * Math.abs(across) * reach;
      const droop = blade.arch * blade.length * along * along;
      const ripple =
        blade.wave * reach * edge * Math.sin(along * 9 + Math.sign(across));
      const groove =
        blade.relief * blade.width * veinAt(along, across, blade.veins);
      return {
        position: [
          (along - notch - lobe) * blade.length,
          lift - droop + ripple - groove,
          across * reach,
        ],
        uv: [column / blade.columns, along],
      };
    });
  });
  const stride = blade.columns + 1;
  const positions = Arr.flatMap(vertices, (vertex) => vertex.position);
  const place = (corner: number) =>
    [
      Number(positions[corner * 3]),
      Number(positions[corner * 3 + 1]),
      Number(positions[corner * 3 + 2]),
    ] as const;
  const normals = Arr.flatMap(Arr.range(0, blade.rows), (row) =>
    Arr.flatMap(Arr.range(0, blade.columns), (column) => {
      const ahead = place(Math.min(blade.rows, row + 1) * stride + column);
      const behind = place(Math.max(0, row - 1) * stride + column);
      const left = place(row * stride + Math.max(0, column - 1));
      const right = place(row * stride + Math.min(blade.columns, column + 1));
      const run = [
        Number(ahead[0]) - Number(behind[0]),
        Number(ahead[1]) - Number(behind[1]),
        Number(ahead[2]) - Number(behind[2]),
      ] as const;
      const span = [
        Number(right[0]) - Number(left[0]),
        Number(right[1]) - Number(left[1]),
        Number(right[2]) - Number(left[2]),
      ] as const;
      const up = [
        span[1] * run[2] - span[2] * run[1],
        span[2] * run[0] - span[0] * run[2],
        span[0] * run[1] - span[1] * run[0],
      ] as const;
      const length = Math.hypot(up[0], up[1], up[2]);
      return [up[0] / length, up[1] / length, up[2] / length];
    })
  );
  const indices = Arr.flatMap(Arr.range(0, blade.rows - 1), (row) =>
    Arr.flatMap(Arr.range(0, blade.columns - 1), (column) => {
      const corner = row * stride + column;
      const above = corner + stride;
      return [corner, corner + 1, above, corner + 1, above + 1, above];
    })
  );
  return {
    indices,
    normals,
    positions,
    uvs: Arr.flatMap(vertices, (vertex) => vertex.uv),
  };
}
