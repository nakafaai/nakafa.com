import { fractalAt } from "@repo/design-system/components/three/field/noise";
import type { Form } from "@repo/design-system/components/three/organism/form";
import {
  smoothNormals,
  unitNormals,
  weldNormals,
} from "@repo/design-system/components/three/organism/form";
import { Array as Arr, Schema } from "effect";
import { Color, Vector3 } from "three";

/**
 * One cross-section of a body along its spine: where the spine passes, and
 * how far the body reaches to each side (`wide`) and up and down (`tall`)
 * there. A tip closes with both at zero.
 */
const StationSchema = Schema.Struct({
  centre: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
  tall: Schema.Finite,
  wide: Schema.Finite,
});
export type Station = typeof StationSchema.Type;

/**
 * A body described by its real structure. `stations` run from tail to head
 * (or root to tip). `around` and `along` are how many faces cross a section
 * and run down the spine. `square` is the section's shape: 2 is an ellipse,
 * more is boxier. `belly` flattens the underside, from 0 to 1. `lump` is how
 * far slow noise swells and dents the body, as a share of its girth, so
 * nothing is a perfect ellipsoid. `up` is where the back faces at the first
 * station. `relief` raises the surface at a place by a share of the girth:
 * pleats, lobes, knuckles. `paint` gives a place its colour: a dark back
 * over a pale belly, stripes, spots. Both read `along` from 0 at the first
 * station to 1 at the last, and `around` from 0 on the back through 0.5 on
 * the belly and on to 1 at the back again.
 */
export interface Loft {
  readonly along: number;
  readonly around: number;
  readonly belly: number;
  readonly lump: number;
  readonly paint: (along: number, around: number, color: Color) => void;
  readonly relief: (along: number, around: number) => number;
  readonly seed: number;
  readonly square: number;
  readonly stations: readonly Station[];
  readonly up: readonly [number, number, number];
}

/** How much a place around a body faces the sky: 1 on the back, 0 on the belly. */
export function dorsal(around: number) {
  return 0.5 + 0.5 * Math.cos(around * 2 * Math.PI);
}

/** A smooth curve through four values a quarter of the way each, at `t` between the middle two. */
function through(a: number, b: number, c: number, d: number, t: number) {
  return (
    0.5 *
    (2 * b +
      (c - a) * t +
      (2 * a - 5 * b + 4 * c - d) * t * t +
      (3 * b - a - 3 * c + d) * t * t * t)
  );
}

/**
 * The body's section at `along`, from 0 at the first station to 1 at the
 * last: a smooth curve through the stations, never narrower than nothing.
 */
export function stationAt(
  stations: readonly Station[],
  along: number
): Station {
  const last = stations.length - 1;
  const place = Math.min(Math.max(along, 0), 1) * last;
  const from = Math.min(Math.floor(place), last - 1);
  const t = place - from;
  const pick = (offset: number) =>
    Arr.getUnsafe(stations, Math.min(Math.max(from + offset, 0), last));
  const [a, b, c, d] = [pick(-1), pick(0), pick(1), pick(2)];
  const axis = (at: 0 | 1 | 2) =>
    through(a.centre[at], b.centre[at], c.centre[at], d.centre[at], t);
  return {
    centre: [axis(0), axis(1), axis(2)],
    tall: Math.max(0, through(a.tall, b.tall, c.tall, d.tall, t)),
    wide: Math.max(0, through(a.wide, b.wide, c.wide, d.wide, t)),
  };
}

/** A power that keeps its sign, which squares off a round section. */
function squared(value: number, square: number) {
  return Math.sign(value) * Math.abs(value) ** (2 / square);
}

/**
 * Lofts a skin over a body's sections: a smooth closed surface with normals,
 * texture coordinates that run along and around it, and a colour at every
 * vertex. The frame that carries each section follows the spine without
 * twisting, so a duct can loop and a tail can curl.
 */
export function loftBody(loft: Loft): Form {
  const rings = loft.along + 1;
  const columns = loft.around + 1;
  const position = new Float32Array(rings * columns * 3);
  const color = new Float32Array(rings * columns * 3);
  const uv = new Float32Array(rings * columns * 2);
  const index = new Uint32Array(loft.along * loft.around * 6);
  const tips: number[][] = [];
  const seams: number[][] = [];
  const up = new Vector3(...loft.up).normalize();
  const tangent = new Vector3();
  const side = new Vector3();
  const ink = new Color();

  for (let ring = 0; ring < rings; ring += 1) {
    const along = ring / loft.along;
    const here = stationAt(loft.stations, along);
    const before = stationAt(loft.stations, along - 0.5 / loft.along);
    const after = stationAt(loft.stations, along + 0.5 / loft.along);
    tangent
      .set(
        after.centre[0] - before.centre[0],
        after.centre[1] - before.centre[1],
        after.centre[2] - before.centre[2]
      )
      .normalize();
    up.addScaledVector(tangent, -up.dot(tangent)).normalize();
    side.crossVectors(tangent, up);
    const tip = here.wide + here.tall < 1e-6;
    if (tip) {
      tips.push(Arr.makeBy(columns, (column) => ring * columns + column));
    }
    seams.push([ring * columns, ring * columns + loft.around]);

    for (let column = 0; column < columns; column += 1) {
      const around = column / loft.around;
      const angle = around * 2 * Math.PI;
      const rise = squared(Math.cos(angle), loft.square);
      const reach = squared(Math.sin(angle), loft.square);
      const swell =
        1 +
        loft.lump * 2 * (fractalAt(around, along, 3, 5, loft.seed, 3) - 0.5) +
        loft.relief(along, around % 1);
      const high = here.tall * swell * (rise < 0 ? 1 - loft.belly : 1) * rise;
      const out = here.wide * swell * reach;
      const vertex = ring * columns + column;
      position.set(
        [
          here.centre[0] + up.x * high + side.x * out,
          here.centre[1] + up.y * high + side.y * out,
          here.centre[2] + up.z * high + side.z * out,
        ],
        vertex * 3
      );
      uv.set([along, around], vertex * 2);
      loft.paint(along, around % 1, ink);
      color.set([ink.r, ink.g, ink.b], vertex * 3);
    }
  }

  for (let ring = 0; ring < loft.along; ring += 1) {
    for (let column = 0; column < loft.around; column += 1) {
      const a = ring * columns + column;
      const b = a + columns;
      index.set([a, a + 1, b, a + 1, b + 1, b], (ring * loft.around + column) * 6);
    }
  }

  const normal = smoothNormals(position, index);
  weldNormals(normal, seams);
  weldNormals(normal, tips);
  unitNormals(normal);
  return { color, index, normal, position, uv };
}

/**
 * A fin, a flipper or the lobe of a fluke: a thin foil `span` long, `chord`
 * deep at its root and tapering to a rounded tip that is swept `sweep` back.
 * `thick` is its thickness at the root. It lies along x with its leading
 * edge towards y, ready for `attachForm`.
 */
export function finBody(fin: {
  readonly along: number;
  readonly around: number;
  readonly chord: number;
  readonly paint: Loft["paint"];
  readonly span: number;
  readonly sweep: number;
  readonly thick: number;
}): Form {
  const stations = Arr.makeBy(8, (step): Station => {
    const out = step / 7;
    const taper = (1 - out ** 2.2) ** 0.7;
    return {
      centre: [fin.span * out, -fin.sweep * out ** 1.6, 0],
      tall: (fin.chord / 2) * taper * (0.55 + 0.45 * (1 - out)),
      wide: (fin.thick / 2) * taper,
    };
  });
  return loftBody({
    along: fin.along,
    around: fin.around,
    belly: 0,
    lump: 0,
    paint: fin.paint,
    relief: () => 0,
    seed: 1,
    square: 2,
    stations,
    up: [0, 1, 0],
  });
}

/**
 * The sections of an egg-shaped body `long` along x about `centre`: a
 * testis, an ovary, a gland, a cell, a nucleus. `wide` and `tall` are its
 * half-breadth and half-height at its fullest, and `blunt` moves that
 * fullest place towards one end, from -1 to 1.
 */
export function ovoid(
  centre: readonly [number, number, number],
  long: number,
  wide: number,
  tall: number,
  blunt: number
): readonly Station[] {
  return Arr.makeBy(9, (step): Station => {
    const along = step / 8;
    const girth =
      Math.sin(Math.PI * along) ** 0.9 * (1 + blunt * (along - 0.5));
    return {
      centre: [centre[0] + (along - 0.5) * long, centre[1], centre[2]],
      tall: tall * girth,
      wide: wide * girth,
    };
  });
}

/**
 * The sections of a duct or a vessel that runs through `points`, each with
 * its own radius: a sperm duct, an oviduct, an artery that narrows as it
 * branches.
 */
export function duct(
  points: readonly (readonly [number, number, number, number])[]
): readonly Station[] {
  return Arr.map(
    points,
    ([x, y, z, radius]): Station => ({
      centre: [x, y, z],
      tall: radius,
      wide: radius,
    })
  );
}
