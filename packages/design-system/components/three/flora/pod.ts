import {
  fractalAt,
  ridgedAt,
} from "@repo/design-system/components/three/field/noise";
import type { Mesh } from "@repo/design-system/components/three/flora/limb";
import { Array as Arr, Schema } from "effect";

/**
 * One pea seed: how wide it is, whether it dried round or shrank into
 * wrinkles, how finely its surface is laid out and which seed it is.
 */
export const PeaSchema = Schema.Struct({
  radius: Schema.Finite,
  rows: Schema.Int,
  seed: Schema.Int,
  wrinkled: Schema.Boolean,
});
export type Pea = typeof PeaSchema.Type;

/**
 * One valve of a pea pod, lying open with its hollow up: how long, how wide
 * and how deep it is, how far it bows along its length, where along it each
 * seed sat (as shares of its length) and how finely it is laid out.
 */
export const ValveSchema = Schema.Struct({
  bow: Schema.Finite,
  depth: Schema.Finite,
  length: Schema.Finite,
  rows: Schema.Int,
  seats: Schema.Array(Schema.Finite),
  width: Schema.Finite,
});
export type Valve = typeof ValveSchema.Type;

/** One place or direction, as x, y and z. */
const PlaceSchema = Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]);
type Place = typeof PlaceSchema.Type;

/** The direction square to two edges of a surface, of length 1. */
function square(a: Place, b: Place): Place {
  const out = [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ] as const;
  const length = Math.hypot(out[0], out[1], out[2]);
  return [out[0] / length, out[1] / length, out[2] / length];
}

/** The difference of two places. */
function from(a: Place, b: Place): Place {
  return [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
}

/** A grid of `rows` by `columns` squares as triangles, wound to face along its normals. */
function grid(rows: number, columns: number) {
  const stride = columns + 1;
  return Arr.flatMap(Arr.range(0, rows - 1), (row) =>
    Arr.flatMap(Arr.range(0, columns - 1), (column) => {
      const corner = row * stride + column;
      const above = corner + stride;
      return [corner, corner + 1, above, corner + 1, above + 1, above];
    })
  );
}

/**
 * How far the coat of a pea stands from its middle in one direction, as a
 * share of its radius. A round pea is nearly a ball, a little flattened,
 * dented at the scar where it hung in the pod and creased where its two seed
 * leaves meet. A wrinkled pea lost its water as it dried: its coat fell in
 * on itself in sharp folds and soft dents.
 */
export function peaReach(pea: Pea, around: number, up: number) {
  const turn = around * 2 * Math.PI;
  const tilt = (up - 0.5) * Math.PI;
  const x = Math.cos(tilt) * Math.cos(turn);
  const y = Math.sin(tilt);
  const z = Math.cos(tilt) * Math.sin(turn);
  const scar = z > 0 ? 0.07 * Math.exp(-(x * x + y * y) * 14) : 0;
  const crease = 0.018 * Math.exp(-((x / 0.09) ** 2)) * Math.max(0, z);
  const grain = 0.02 * (fractalAt(around, up, 8, 6, pea.seed) - 0.5);
  if (!pea.wrinkled) {
    return 1 - scar - crease + grain;
  }
  const folds = 0.2 * (ridgedAt(around, up, 5, 4, pea.seed) - 0.55);
  const dents = 0.14 * (fractalAt(around, up, 3, 2, pea.seed + 9) - 0.5);
  return 0.93 - scar + grain + (folds + dents) * Math.cos(tilt);
}

/** The place on the coat of a pea in one direction. */
function peaPlace(pea: Pea, around: number, up: number): Place {
  const turn = around * 2 * Math.PI;
  const tilt = (up - 0.5) * Math.PI;
  const reach = pea.radius * peaReach(pea, around, up);
  return [
    reach * Math.cos(tilt) * Math.cos(turn),
    reach * Math.sin(tilt) * 0.93,
    reach * Math.cos(tilt) * Math.sin(turn),
  ];
}

/**
 * The coat of one pea seed as triangles, its scar toward +z. Its normals
 * follow every fold and dent, so the wrinkles of a wrinkled pea are real
 * relief that catches the light.
 */
export function peaMesh(pea: Pea): Mesh {
  const columns = pea.rows * 2;
  const step = 0.25 / pea.rows;
  const vertices = Arr.flatMap(Arr.range(0, pea.rows), (row) =>
    Arr.map(Arr.range(0, columns), (column) => {
      const around = column / columns;
      const up = Math.min(0.999, Math.max(0.001, row / pea.rows));
      const place = peaPlace(pea, around, up);
      return {
        normal: square(
          from(place, peaPlace(pea, around, up + step)),
          from(place, peaPlace(pea, around + step, up))
        ),
        position: place,
        uv: [around, up],
      };
    })
  );
  return {
    indices: grid(pea.rows, columns),
    normals: Arr.flatMap(vertices, (vertex) => vertex.normal),
    positions: Arr.flatMap(vertices, (vertex) => vertex.position),
    uvs: Arr.flatMap(vertices, (vertex) => vertex.uv),
  };
}

/** The place on a pod valve `along` its length (0 at the stalk, 1 at the beak) and `across` it (-1 and 1 at its two sutures). */
export function valvePlace(valve: Valve, along: number, across: number): Place {
  const swell = Math.sin(Math.PI * Math.min(1, along * 1.06)) ** 0.55;
  const seated = Arr.reduce(valve.seats, 0, (most, seat) =>
    Math.max(most, Math.exp(-(((along - seat) / 0.07) ** 2)))
  );
  const hollow = Math.cos((across * Math.PI) / 2) ** 0.8;
  const suture = 0.1 * Math.abs(across) ** 10;
  return [
    (along - 0.5) * valve.length,
    valve.bow * valve.length * (2 * along - 1) ** 2 -
      valve.depth * swell * (hollow * (1 + 0.28 * seated) - suture),
    across * (valve.width / 2) * swell * (1 + 0.1 * seated),
  ];
}

/**
 * One valve of a pea pod as triangles, facing into its hollow: it swells
 * from the stalk, narrows to the beak, bulges over every seat a seed pressed
 * into it and stands in a ridge along each suture, where the two valves were
 * joined and the pod split.
 */
export function valveMesh(valve: Valve): Mesh {
  const columns = Math.round(valve.rows / 3);
  const vertices = Arr.flatMap(Arr.range(0, valve.rows), (row) =>
    Arr.map(Arr.range(0, columns), (column) => {
      const along = 0.004 + 0.992 * (row / valve.rows);
      const across = (2 * column) / columns - 1;
      const place = valvePlace(valve, along, across);
      return {
        normal: square(
          from(place, valvePlace(valve, along, across + 0.01)),
          from(place, valvePlace(valve, along + 0.004, across))
        ),
        position: place,
        uv: [across / 2 + 0.5, along],
      };
    })
  );
  return {
    indices: grid(valve.rows, columns),
    normals: Arr.flatMap(vertices, (vertex) => vertex.normal),
    positions: Arr.flatMap(vertices, (vertex) => vertex.position),
    uvs: Arr.flatMap(vertices, (vertex) => vertex.uv),
  };
}
