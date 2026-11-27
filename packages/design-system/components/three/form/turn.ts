import {
  sidesFor,
  stepFor,
} from "@repo/design-system/components/three/form/detail";
import { stitch } from "@repo/design-system/components/three/form/mesh";
import type { Point } from "@repo/design-system/components/three/form/path";
import {
  add,
  angle,
  arcThrough,
  cross,
  dot,
  scale,
  size,
  sub,
  unit,
} from "@repo/design-system/components/three/form/path";
import { Array as Arr, Match, Predicate, Schema } from "effect";

/** One point of an outline: its radius from the axis, then its height. */
const OutlinePointSchema = Schema.Tuple([Schema.Finite, Schema.Finite]);
type OutlinePoint = typeof OutlinePointSchema.Type;

/**
 * A part made by turning an outline about the vertical axis: a beaker, a
 * flask, a dome, a flange, a piston, a bung or a droplet.
 */
export const TurnSchema = Schema.Struct({
  /**
   * A cutaway: the angle the turn starts at and how far round it goes, in
   * radians, measured from +z toward +x. A full turn when not named.
   */
  arc: Schema.optionalKey(Schema.Tuple([Schema.Finite, Schema.Finite])),
  /**
   * The outline, as radius and height, in scene units. The surface faces
   * the right of the way the outline runs, so an outline drawn from the
   * base up shows its outside. A radius of 0 closes it on the axis. Gentle
   * corners are rounded into curves and sharp ones keep a fine edge.
   */
  profile: Schema.Array(OutlinePointSchema),
  /** A pouring spout drawn out of the rim toward +x. */
  spout: Schema.optionalKey(Schema.Boolean),
  /**
   * Glass: the wall's thickness, or the wall's and the base's. The outline
   * is then the outside alone, and the part gets its inside, a rounded lip
   * and a base half as thick again as its wall unless one is named.
   */
  wall: Schema.optionalKey(
    Schema.Union([Schema.Finite, Schema.Tuple([Schema.Finite, Schema.Finite])])
  ),
});
export type Turn = typeof TurnSchema.Type;

/** The turn at which a corner stops being a curve and becomes an edge, in radians. */
const CREASE = (50 * Math.PI) / 180;

/** The turn past which an outline doubles back and its corner stays a point. */
const FOLD = (170 * Math.PI) / 180;

/**
 * The fewest sides a full turn keeps, however small the part is in its lab:
 * a camera that flies in to one vessel must still find its rim round.
 */
const ROUND = 32;

/** The radius of a sharp edge, as a share of the part's size: wide enough to catch the light across more than one pixel. */
const EDGE = 0.02;

/** The most pieces one rounded corner takes. */
const PIECES = 12;

/** How much thicker than its wall a glass vessel's base is, when none is named. */
const BASE = 1.5;

/** How far a mitred corner of the inside may stand from its outside, in wall thicknesses. */
const MITRE = 3;

/** A spout: how far down the rim it starts, how far it draws out, and how far it rises, as shares of the rim's radius. */
const SPOUT_DEPTH = 0.28;
const SPOUT_REACH = 0.12;
const SPOUT_RISE = 0.057;

/** How tightly a spout is pinched: higher is narrower. */
const SPOUT_PINCH = 10;

/** An outline's point in the plane the vector helpers work in. */
function flat([radius, height]: OutlinePoint): Point {
  return [radius, height, 0];
}

/** The side a surface faces, from the unit heading of its outline: the right of the way it runs. */
function facing(heading: Point): Point {
  return [heading[1], -heading[0], 0];
}

/**
 * The outline of a glass vessel from its outside alone: up the outside,
 * over a rounded lip, and back down an inside that keeps the wall's
 * thickness, with a heavier base where the outline leaves the axis. A
 * vessel with no base, a sleeve, gets a lip at both ends and closes on
 * itself.
 */
function walled(
  profile: readonly Point[],
  wall: number,
  base: number,
  grain: number
) {
  const last = profile.length - 1;
  const legs = Arr.map(Arr.dropRight(profile, 1), (point, index) =>
    unit(sub(profile[index + 1], point))
  );
  const based = profile[0][0] === 0;
  const foot = based
    ? Arr.takeWhile(legs, (leg) => Math.abs(leg[1]) <= Math.abs(leg[0])).length
    : 0;
  const depths = Arr.map(legs, (_, index) => (index < foot ? base : wall));
  const inward = Arr.map(legs, (leg) => scale(facing(leg), -1));
  const inside = Arr.map(profile, (point, index): Point => {
    const before = Math.max(0, index - 1);
    const after = Math.min(last - 1, index);
    const [a, b] = [inward[before], inward[after]];
    const span = a[0] * b[1] - a[1] * b[0];
    const offset: Point =
      Math.abs(span) < 1e-9
        ? scale(b, depths[after])
        : [
            (depths[before] * b[1] - depths[after] * a[1]) / span,
            (a[0] * depths[after] - b[0] * depths[before]) / span,
            0,
          ];
    const reach = Math.min(1, (MITRE * wall) / size(offset));
    const moved = add(point, scale(offset, reach));
    return [Math.max(0, moved[0]), moved[1], 0];
  });
  const pieces = Math.min(
    8,
    Math.max(4, Math.ceil(Math.PI / stepFor(grain, wall / 2)))
  );
  const lip = (from: Point, to: Point, along: Point) => {
    const centre = scale(add(from, to), 0.5);
    const out = sub(from, centre);
    return Arr.makeBy(pieces - 1, (step) => {
      const lean = ((step + 1) / pieces) * Math.PI;
      return add(
        centre,
        add(
          scale(out, Math.cos(lean)),
          scale(along, Math.sin(lean) * size(out))
        )
      );
    });
  };
  const floor: Point = [
    0,
    profile[0][1] + (depths[0] * inward[0][1]) / Math.max(inward[0][1], 1e-9),
    0,
  ];
  const up = [...profile, ...lip(profile[last], inside[last], legs[last - 1])];
  const down = Arr.reverse(Arr.drop(inside, 1));
  return based
    ? [...up, ...down, floor]
    : [
        ...up,
        ...down,
        inside[0],
        ...lip(inside[0], profile[0], scale(legs[0], -1)),
        profile[0],
      ];
}

/** One row of a turned surface: where its outline stands, and the side the surface faces there. */
function rowAt(place: Point, heading: Point) {
  return { face: facing(heading), place };
}

/**
 * An outline's rows: every gentle corner rounded into an arc that takes half
 * of its shorter leg, every sharp one cut to a fine edge that still catches
 * the light, and a corner that doubles back kept as a point.
 */
function rounded(outline: readonly Point[], grain: number) {
  const last = outline.length - 1;
  const closed = size(sub(outline[0], outline[last])) < 1e-12;
  const extent = Arr.reduce(outline, 0, (most, point) =>
    Math.max(most, point[0], Math.abs(point[1] - outline[0][1]))
  );
  const corner = (before: Point, point: Point, after: Point) => {
    const turn = angle(sub(point, before), sub(after, point));
    const half =
      Math.min(size(sub(point, before)), size(sub(after, point))) / 2;
    const cut = turn < CREASE ? half : Math.min(half, EDGE * extent);
    const pieces = Math.min(
      PIECES,
      Math.max(1, Math.ceil(turn / stepFor(grain, cut / Math.tan(turn / 2))))
    );
    return Arr.map(
      turn < FOLD
        ? arcThrough(before, point, after, cut, pieces)
        : arcThrough(before, point, after, 0, 1),
      (sample) => rowAt(sample.place, sample.heading)
    );
  };
  const inner = Arr.flatMap(
    Arr.drop(Arr.dropRight(outline, 1), 1),
    (point, index) => corner(outline[index], point, outline[index + 2])
  );
  const seam = closed ? corner(outline[last - 1], outline[0], outline[1]) : [];
  const rows = closed
    ? [...seam, ...inner, seam[0]]
    : [
        rowAt(outline[0], unit(sub(outline[1], outline[0]))),
        ...inner,
        rowAt(outline[last], unit(sub(outline[last], outline[last - 1]))),
      ];
  return Arr.dedupeAdjacentWith(
    rows,
    (a, b) =>
      size(sub(a.place, b.place)) < 1e-12 && dot(a.face, b.face) > 1 - 1e-9
  );
}

/**
 * The surface of a turned part: its vertices, their normals, their texture
 * coordinates in scene units (around its widest ring, then along its
 * outline) and its triangles. The outline's corners are rounded or edged,
 * a wall gives it an inside with a lip and a base, a spout is drawn out of
 * its rim, and it has as many sides as the grain asks for.
 *
 * @param turn - What the part is
 * @param grain - The farthest a facet may stand off the true surface, from `grainOf`
 */
export function turnShape(turn: Turn, grain: number) {
  const drawn = Arr.dedupeAdjacentWith(
    Arr.map(turn.profile, flat),
    (a, b) => size(sub(a, b)) < 1e-12
  );
  const outline = Match.value(turn.wall).pipe(
    Match.when(Predicate.isUndefined, () => drawn),
    Match.when(Predicate.isNumber, (wall) =>
      walled(drawn, wall, wall * BASE, grain)
    ),
    Match.orElse(([wall, base]) => walled(drawn, wall, base, grain))
  );
  const widest = Arr.reduce(outline, 0, (most, point) =>
    Math.max(most, point[0])
  );
  const rim = Arr.reduce(drawn, drawn[0], (top, point) =>
    point[1] >= top[1] ? point : top
  );
  const depth = SPOUT_DEPTH * rim[0];
  const lip = rim[1] - depth;
  const pour = turn.spout ?? false;

  const smooth = rounded(outline, grain);
  const rows = pour
    ? Arr.flatMap(smooth, (row, index) => {
        const next = smooth[Math.min(smooth.length - 1, index + 1)];
        const share = (lip - row.place[1]) / (next.place[1] - row.place[1]);
        return share > 0 && share < 1
          ? [
              row,
              {
                face: unit(
                  add(scale(row.face, 1 - share), scale(next.face, share))
                ),
                place: add(
                  scale(row.place, 1 - share),
                  scale(next.place, share)
                ),
              },
            ]
          : [row];
      })
    : smooth;

  const [start, sweep] = turn.arc ?? [0, 2 * Math.PI];
  const sides = Math.max(
    3,
    Math.ceil(
      (Math.max(ROUND, sidesFor(grain, widest)) * sweep) / (2 * Math.PI) - 1e-9
    )
  );
  const columns = sides + 1;
  const drawOut = ([x, y, z]: Point): Point => {
    const lift = pour ? Math.max(0, (y - lip) / depth) : 0;
    const toward =
      Math.max(0, x / Math.max(Math.hypot(x, z), 1e-12)) ** SPOUT_PINCH;
    return [
      x * (1 + SPOUT_REACH * lift * toward),
      y + SPOUT_RISE * rim[0] * lift * toward,
      z,
    ];
  };
  const reach = widest * 1e-4;

  const positions = new Float32Array(rows.length * columns * 3);
  const normals = new Float32Array(rows.length * columns * 3);
  const uvs = new Float32Array(rows.length * columns * 2);
  let travel = 0;
  Arr.forEach(rows, (row, index) => {
    const [radius, height] = row.place;
    travel += size(sub(row.place, rows[Math.max(0, index - 1)].place));
    const drawn = pour && height > lip && radius > 0;
    for (let column = 0; column < columns; column += 1) {
      const around = start + (column / sides) * sweep;
      const out: Point = [Math.sin(around), 0, Math.cos(around)];
      const place = add(scale(out, radius), [0, height, 0]);
      const vertex = index * columns + column;
      positions.set(drawOut(place), vertex * 3);
      if (drawn) {
        const along = scale(
          add(scale(out, -row.face[1]), [0, row.face[0], 0]),
          reach
        );
        const round: Point = [out[2] * reach, 0, -out[0] * reach];
        normals.set(
          unit(
            cross(
              sub(drawOut(add(place, round)), drawOut(sub(place, round))),
              sub(drawOut(add(place, along)), drawOut(sub(place, along)))
            )
          ),
          vertex * 3
        );
      } else {
        normals.set(
          add(scale(out, row.face[0]), [0, row.face[1], 0]),
          vertex * 3
        );
      }
      uvs.set([around * widest, travel], vertex * 2);
    }
  });

  return {
    indices: stitch(
      sides,
      Arr.map(rows, (row) => row.place[0]),
      Arr.filter(
        Arr.makeBy(rows.length - 1, (row) => row),
        (row) => size(sub(rows[row].place, rows[row + 1].place)) < 1e-12
      )
    ),
    normals,
    positions,
    uvs,
  };
}
