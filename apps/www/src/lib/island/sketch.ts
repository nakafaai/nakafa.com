import { Array as Arr } from "effect";
import type { Brush } from "@/lib/island/land/stroke";
import { HUES } from "@/lib/island/models/hues";
import type { Face, Rgb, Vec } from "@/lib/island/models/parts";
import { normalOf } from "@/lib/island/models/parts";

/*
 * The small pictures the HUD shows of what the world draws (ADR 0050, W7): a
 * thing on its shelf tile, an animal in the field guide, a brush's swatch.
 * Each is drawn from the same model or tone the world itself uses, so a
 * picture never shows something the land does not.
 */

/**
 * How a sketch looks at its model: turned to show its front and one side,
 * from a little above, lit from the upper left, with a pixel of room about it.
 */
const VIEW = { ambient: 0.6, margin: 1, pitch: 0.5, yaw: -0.6 } as const;

/** Where the light comes from, as the sketch sees it: across, up, and toward the eye. */
const LIGHT = [-0.38, 0.74, 0.55] as const;

/** A model's corner as the sketch sees it: across, up, and how near the eye it is. */
function turned([x, y, z]: Vec): Vec {
  const across = x * Math.cos(VIEW.yaw) + z * Math.sin(VIEW.yaw);
  const deep = z * Math.cos(VIEW.yaw) - x * Math.sin(VIEW.yaw);
  return [
    across,
    y * Math.cos(VIEW.pitch) - deep * Math.sin(VIEW.pitch),
    y * Math.sin(VIEW.pitch) + deep * Math.cos(VIEW.pitch),
  ];
}

/** How bright a face is, from its ambient share to 1: the side it shows the eye, against the light. */
function lightOn(corners: readonly Vec[]) {
  const [across, up, near] = turned(normalOf(corners));
  const side = near < 0 ? -1 : 1;
  const lit = (across * LIGHT[0] + up * LIGHT[1] + near * LIGHT[2]) * side;
  return VIEW.ambient + (1 - VIEW.ambient) * Math.max(0, lit);
}

/** Twice the signed area of the triangle from `a` over `b` to `c` on the picture. */
function areaOf(a: Vec, b: Vec, c: Vec) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/** Paints one triangle into the picture, each pixel only where nothing nearer was painted. */
function fill(
  pixels: Uint8ClampedArray<ArrayBuffer>,
  nearest: Float32Array<ArrayBuffer>,
  side: number,
  [a, b, c]: readonly [Vec, Vec, Vec],
  ink: Rgb
) {
  const area = areaOf(a, b, c);
  if (Math.abs(area) < 1e-9) {
    return;
  }
  const last = Math.ceil(Math.max(a[1], b[1], c[1]));
  const right = Math.ceil(Math.max(a[0], b[0], c[0]));
  for (let row = Math.floor(Math.min(a[1], b[1], c[1])); row < last; row += 1) {
    for (
      let column = Math.floor(Math.min(a[0], b[0], c[0]));
      column < right;
      column += 1
    ) {
      const point: Vec = [column + 0.5, row + 0.5, 0];
      const toA = areaOf(b, c, point) / area;
      const toB = areaOf(c, a, point) / area;
      const toC = 1 - toA - toB;
      const near = toA * a[2] + toB * b[2] + toC * c[2];
      const at = row * side + column;
      if (toA < 0 || toB < 0 || toC < 0 || near <= nearest[at]) {
        continue;
      }
      nearest[at] = near;
      pixels[at * 4] = ink[0] * 255;
      pixels[at * 4 + 1] = ink[1] * 255;
      pixels[at * 4 + 2] = ink[2] * 255;
      pixels[at * 4 + 3] = 255;
    }
  }
}

/**
 * A model as a small square picture, `side` pixels a side, as red, green,
 * blue and alpha: the whole model fitted inside the square on a clear ground,
 * every face in its own flat color, brighter toward the light, the nearer
 * face over the farther. A model with no face is a clear square.
 */
export function sketchOf(faces: readonly Face[], side: number) {
  const pixels = new Uint8ClampedArray(side * side * 4);
  const seen = Arr.map(faces, (face) => ({
    corners: Arr.map(face.corners, turned),
    ink: Arr.map(face.color, (channel) => channel * lightOn(face.corners)),
  }));
  const corners = Arr.flatMap(seen, (face) => face.corners);
  if (!Arr.isReadonlyArrayNonEmpty(corners)) {
    return pixels;
  }
  const across = Arr.map(corners, (corner) => corner[0]);
  const up = Arr.map(corners, (corner) => corner[1]);
  const [left, top] = [Math.min(...across), Math.max(...up)];
  const [wide, high] = [Math.max(...across) - left, top - Math.min(...up)];
  const room = side - VIEW.margin * 2;
  const scale = room / Math.max(wide, high, 1e-6);
  const place = ([x, y, near]: Vec): Vec => [
    (side - wide * scale) / 2 + (x - left) * scale,
    (side - high * scale) / 2 + (top - y) * scale,
    near,
  ];
  const nearest = new Float32Array(side * side).fill(Number.NEGATIVE_INFINITY);
  for (const face of seen) {
    const [first, ...rest] = Arr.map(face.corners, place);
    const [red, green, blue] = face.ink;
    for (const [second, third] of Arr.zip(rest, Arr.drop(rest, 1))) {
      fill(pixels, nearest, side, [first, second, third], [red, green, blue]);
    }
  }
  return pixels;
}

/** The tone each brush lays or leaves on the land, from the world's own colors. */
const SWATCH = {
  clear: HUES.brick,
  grass: HUES.leaf,
  level: HUES.straw,
  lower: HUES.slate,
  meadow: HUES.pink,
  path: HUES.oak,
  pond: HUES.water,
  raise: HUES.stone,
  sand: HUES.cream,
} satisfies Record<Brush, Rgb>;

/** A brush's swatch as a CSS color. */
export function swatchOf(brush: Brush) {
  const [red, green, blue] = SWATCH[brush];
  return `rgb(${Math.round(red * 255)} ${Math.round(green * 255)} ${Math.round(blue * 255)})`;
}
