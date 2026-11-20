import { useFrame } from "@react-three/fiber";
import type { Point } from "@repo/design-system/components/contents/biology/heart/anatomy";
import {
  ACROSS,
  AORTA,
  AXIS,
  MITRAL,
  PAPILLARY,
  PULMONARY,
  PULMONARY_VALVE,
  place,
  TRICUSPID,
} from "@repo/design-system/components/contents/biology/heart/anatomy";
import { momentAt } from "@repo/design-system/components/contents/biology/heart/cycle";
import { cutDepth } from "@repo/design-system/components/contents/biology/heart/field";
import {
  usePulse,
  useTissue,
} from "@repo/design-system/components/contents/biology/heart/pulse";
import { HEART_COLORS } from "@repo/design-system/lib/material/heart";
import { Array as Arr, Result, Schema } from "effect";
import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry, DoubleSide, Vector3 } from "three";

/** How finely each leaflet is drawn: columns across it and rows from its hinge to its free edge. */
const COLUMNS = 20;
const ROWS = 9;

/** Valve tissue: pale, glistening, a little translucent at its thin edge. */
const LEAFLET_TISSUE = {
  clearcoat: 0.5,
  clearcoatRoughness: 0.3,
  color: HEART_COLORS.leaflet,
  roughness: 0.5,
  sheen: 0.35,
  sheenColor: HEART_COLORS.leaflet,
  side: DoubleSide,
};

/** The chordae tendineae: white, tendon-like cords. */
const CHORD_TISSUE = {
  clearcoat: 0.5,
  color: HEART_COLORS.chord,
  roughness: 0.38,
};

/** The radius of a chorda tendinea, in centimetres: about 1 mm across. */
const CHORD_RADIUS = 0.045;

const vector = (point: Point) => new Vector3(point[0], point[1], point[2]);

/**
 * The frame of a valve ring whose blood flows along `axis`: one direction
 * across the frontal plane (toward the body's left) and one toward the back,
 * so that a ring point at angle φ in [0, π] lies behind the centre.
 */
function ringFrame(axis: Vector3) {
  const back = new Vector3(0, 0, -1).addScaledVector(axis, axis.z).normalize();
  const side = new Vector3().crossVectors(back, axis).normalize();
  if (side.dot(vector(ACROSS)) < 0) {
    side.negate();
  }
  return { back, side };
}

/** The angles of a ring that lie behind the cut, where `centre` is the ring's middle and `radius` its size. */
function behindCut(centre: Vector3, radius: number) {
  const start = Math.asin(
    Math.max(
      -1,
      Math.min(1, (centre.z - cutDepth(centre.x, centre.y)) / radius)
    )
  );
  return { from: start, to: Math.PI - start };
}

/** The leaflets of a valve as rows of points, closed and open, plus the free edge's points. */
function grid(
  point: (column: number, row: number, open: boolean, target: Vector3) => void
) {
  const closed = new Float32Array(COLUMNS * ROWS * 3);
  const open = new Float32Array(COLUMNS * ROWS * 3);
  const target = new Vector3();
  for (let column = 0; column < COLUMNS; column += 1) {
    for (let row = 0; row < ROWS; row += 1) {
      const at = (column * ROWS + row) * 3;
      point(column / (COLUMNS - 1), row / (ROWS - 1), false, target);
      closed.set([target.x, target.y, target.z], at);
      point(column / (COLUMNS - 1), row / (ROWS - 1), true, target);
      open.set([target.x, target.y, target.z], at);
    }
  }
  return { closed, open };
}

/**
 * The leaflets of an atrioventricular valve hanging from its ring into the
 * ventricle, each spanning a share of the ring behind the cut (`from` to
 * `to`) with its length from hinge to free edge. Open, they hang along the
 * flow; shut, they meet across the middle, domed a little toward the atrium,
 * the rest of each leaflet pressed against its neighbour below.
 */
function atrioventricular(
  ring: { across: number; along: number; depth: number; radius: number },
  leaflets: readonly (readonly [number, number, number])[]
) {
  const centre = vector(place(ring.along, ring.across, ring.depth));
  const axis = vector(AXIS);
  const { back, side } = ringFrame(axis);
  const arc = behindCut(centre, ring.radius);
  const radial = new Vector3();
  return Arr.map(leaflets, ([from, to, length]) =>
    grid((u, s, open, target) => {
      const angle = arc.from + (arc.to - arc.from) * (from + (to - from) * u);
      radial
        .copy(side)
        .multiplyScalar(Math.cos(angle))
        .addScaledVector(back, Math.sin(angle));
      const reach = length * (0.4 + 0.6 * Math.sin(Math.PI * u) ** 0.6);
      const hinge = ring.radius * 0.97;
      target.copy(centre).addScaledVector(radial, hinge);
      if (open) {
        target
          .addScaledVector(axis, reach * s * 0.96)
          .addScaledVector(
            radial,
            -reach * s * 0.22 + 0.1 * reach * Math.sin(Math.PI * s)
          );
        return;
      }
      const across = hinge * 0.93;
      const travel = reach * s;
      if (travel <= across) {
        target
          .addScaledVector(radial, -travel)
          .addScaledVector(axis, -0.28 * Math.sin((Math.PI * travel) / across));
        return;
      }
      target
        .addScaledVector(radial, -across)
        .addScaledVector(axis, travel - across);
    })
  );
}

/**
 * The three pocket cusps of a semilunar valve in the root that starts at
 * `centre` and runs along `axis`, `radius` wide at its ring. Each cusp hangs
 * from a crescent of wall that rises to its commissures `height` above the
 * ring. Shut, the cusps meet in the middle and sag into pockets that fill
 * with blood; open, they lie back against the wall of their sinuses.
 */
function semilunar(
  centre: Vector3,
  axis: Vector3,
  radius: number,
  height: number
) {
  const { back, side } = ringFrame(axis);
  const arc = behindCut(centre, radius);
  const radial = new Vector3();
  const third = (2 * Math.PI) / 3;
  const cusps = [Math.PI / 6 - third, Math.PI / 6, Math.PI / 6 + third];
  return Arr.filterMap(cusps, (start) => {
    const from = Math.max(start, arc.from);
    const to = Math.min(start + third, arc.to);
    if (to <= from) {
      return Result.failVoid;
    }
    return Result.succeed(
      grid((u, s, open, target) => {
        const angle = from + (to - from) * u;
        const across = (angle - start) / third;
        radial
          .copy(side)
          .multiplyScalar(Math.cos(angle))
          .addScaledVector(back, Math.sin(angle));
        const rise = height * (1 - Math.sin(Math.PI * across));
        const wall = radius * (0.97 + 0.12 * (rise / height));
        const hingeX = centre.x + radial.x * wall + axis.x * rise;
        const hingeY = centre.y + radial.y * wall + axis.y * rise;
        const hingeZ = centre.z + radial.z * wall + axis.z * rise;
        const middle = 1 - Math.abs(2 * across - 1);
        const edge = open
          ? new Vector3()
              .copy(centre)
              .addScaledVector(axis, height * 0.95)
              .addScaledVector(radial, wall * 0.84)
          : new Vector3()
              .copy(centre)
              .addScaledVector(axis, height * (0.82 + 0.18 * (1 - middle)))
              .addScaledVector(radial, wall * (1 - middle) * 0.96 + 0.03);
        target.set(
          hingeX + (edge.x - hingeX) * s,
          hingeY + (edge.y - hingeY) * s,
          hingeZ + (edge.z - hingeZ) * s
        );
        const pocket = Math.sin(Math.PI * s) * Math.sin(Math.PI * across);
        target.addScaledVector(axis, open ? 0 : -0.32 * pocket * height);
        target.addScaledVector(radial, open ? 0.12 * pocket : 0);
      })
    );
  });
}

/** One leaflet's points, shut and open. */
type Sheet = ReturnType<typeof grid>;

/** The triangles of a valve's leaflets: each a grid of quads. */
function sheetGeometry(sheets: readonly Sheet[]) {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(sheets.length * COLUMNS * ROWS * 3), 3)
  );
  const indices = Arr.flatMap(Arr.range(0, sheets.length - 1), (sheet) =>
    Arr.flatMap(Arr.range(0, COLUMNS - 2), (column) =>
      Arr.flatMap(Arr.range(0, ROWS - 2), (row) => {
        const a = sheet * COLUMNS * ROWS + column * ROWS + row;
        const b = a + ROWS;
        return [a, b, a + 1, b, b + 1, a + 1];
      })
    )
  );
  geometry.setIndex(indices);
  return geometry;
}

/** Moves a valve's leaflets `open` of the way from shut to open. */
function shape(
  geometry: BufferGeometry,
  sheets: readonly Sheet[],
  open: number
) {
  const position = geometry.getAttribute("position");
  if (!(position instanceof BufferAttribute)) {
    return;
  }
  Arr.forEach(sheets, (sheet, index) => {
    const offset = index * COLUMNS * ROWS * 3;
    for (let at = 0; at < sheet.closed.length; at += 1) {
      const shut = sheet.closed[at];
      position.array[offset + at] = shut + (sheet.open[at] - shut) * open;
    }
  });
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}

/** How many sides a chorda's tube has. */
const SIDES = 6;

/**
 * A chorda tendinea from the free edge of `sheet` at `column` to a papillary
 * muscle's tip or the septum at `anchor`.
 */
const ChordSchema = Schema.Struct({
  anchor: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
  column: Schema.Int,
  sheet: Schema.Int,
});
type Chord = typeof ChordSchema.Type;

/** The tubes of a valve's chordae, which `tie` lays between their two ends. */
function chordGeometry(count: number) {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(count * SIDES * 2 * 3), 3)
  );
  const indices = Arr.flatMap(Arr.range(0, count - 1), (chord) =>
    Arr.flatMap(Arr.range(0, SIDES - 1), (side) => {
      const base = chord * SIDES * 2;
      const next = (side + 1) % SIDES;
      return [
        base + side,
        base + SIDES + side,
        base + next,
        base + next,
        base + SIDES + side,
        base + SIDES + next,
      ];
    })
  );
  geometry.setIndex(indices);
  return geometry;
}

/** Lays each chorda from the leaflet's free edge, `open` of the way open, to its anchor. */
function tie(
  geometry: BufferGeometry,
  chords: readonly Chord[],
  sheets: readonly Sheet[],
  open: number
) {
  const position = geometry.getAttribute("position");
  if (!(position instanceof BufferAttribute)) {
    return;
  }
  const edge = new Vector3();
  const anchor = new Vector3();
  const along = new Vector3();
  const across = new Vector3();
  const around = new Vector3();
  Arr.forEach(chords, (chord, index) => {
    const sheet = Arr.getUnsafe(sheets, chord.sheet);
    const at = (chord.column * ROWS + ROWS - 1) * 3;
    edge.set(
      sheet.closed[at] + (sheet.open[at] - sheet.closed[at]) * open,
      sheet.closed[at + 1] + (sheet.open[at + 1] - sheet.closed[at + 1]) * open,
      sheet.closed[at + 2] + (sheet.open[at + 2] - sheet.closed[at + 2]) * open
    );
    anchor.set(chord.anchor[0], chord.anchor[1], chord.anchor[2]);
    along.subVectors(anchor, edge).normalize();
    across.set(0, 0, 1).cross(along).normalize();
    around.crossVectors(along, across);
    for (let side = 0; side < SIDES; side += 1) {
      const turn = (side / SIDES) * Math.PI * 2;
      const dx =
        (Math.cos(turn) * across.x + Math.sin(turn) * around.x) * CHORD_RADIUS;
      const dy =
        (Math.cos(turn) * across.y + Math.sin(turn) * around.y) * CHORD_RADIUS;
      const dz =
        (Math.cos(turn) * across.z + Math.sin(turn) * around.z) * CHORD_RADIUS;
      position.setXYZ(
        index * SIDES * 2 + side,
        edge.x + dx,
        edge.y + dy,
        edge.z + dz
      );
      position.setXYZ(
        index * SIDES * 2 + SIDES + side,
        anchor.x + dx * 1.6,
        anchor.y + dy * 1.6,
        anchor.z + dz * 1.6
      );
    }
  });
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}

/**
 * The leaflets of both atrioventricular valves: the mitral valve's posterior
 * leaflet on the lateral side and its longer anterior leaflet by the septum
 * (about 1.4 and 2.2 cm from hinge to edge), and the tricuspid valve's
 * septal, posterior and anterior leaflets (OpenStax 19.1).
 */
function inflowSheets() {
  return [
    ...atrioventricular(MITRAL, [
      [0, 0.55, 1.35],
      [0.55, 1, 2.2],
    ]),
    ...atrioventricular(TRICUSPID, [
      [0, 0.35, 1.5],
      [0.35, 0.68, 1.6],
      [0.68, 1, 2.0],
    ]),
  ];
}

/** Where on the septum the tricuspid valve's septal leaflet is tied, by its own short chordae. */
const SEPTAL = place(1.9, -1.95, -0.3);

/**
 * The chordae: each papillary muscle ties the halves of the leaflets nearest
 * it, so the mitral valve's lateral half goes to the anterior muscle and its
 * medial half to the posterior one; the tricuspid valve's septal leaflet is
 * tied to the septum, its posterior leaflet to the posterior muscle and its
 * anterior leaflet to the anterior muscle.
 */
function inflowChords(): readonly Chord[] {
  const spots = [0.12, 0.37, 0.63, 0.88];
  const tied = (sheet: number, anchor: (share: number) => Point) =>
    Arr.map(spots, (share) => ({
      anchor: anchor(share),
      column: Math.round(share * (COLUMNS - 1)),
      sheet,
    }));
  return [
    ...tied(0, (share) =>
      share < 0.6 ? PAPILLARY.leftFront.tip : PAPILLARY.leftBack.tip
    ),
    ...tied(1, () => PAPILLARY.leftBack.tip),
    ...tied(2, () => SEPTAL),
    ...tied(3, () => PAPILLARY.rightBack.tip),
    ...tied(4, (share) =>
      share < 0.5 ? PAPILLARY.rightBack.tip : PAPILLARY.rightFront.tip
    ),
  ];
}

/** The cusps of the semilunar valve at a root running from `ring` toward `next`, `height` tall. */
function rootCusps(
  ring: readonly [number, number, number, number],
  next: readonly [number, number, number, number],
  height: number
) {
  return semilunar(
    new Vector3(ring[0], ring[1], ring[2]),
    new Vector3(
      next[0] - ring[0],
      next[1] - ring[1],
      next[2] - ring[2]
    ).normalize(),
    ring[3],
    height
  );
}

/** The aortic and pulmonary valves, each with its cusps behind the cut. */
function outflowSheets() {
  return [
    ...rootCusps(Arr.getUnsafe(AORTA, 0), Arr.getUnsafe(AORTA, 1), 1.4),
    ...rootCusps(
      Arr.getUnsafe(PULMONARY, PULMONARY_VALVE),
      Arr.getUnsafe(PULMONARY, PULMONARY_VALVE + 1),
      1.3
    ),
  ];
}

/**
 * The four valves, moved by the pressures of the beat: the atrioventricular
 * valves open as far as the model's mitral leaflets and the semilunar valves
 * as far as its aortic cusps. The right heart's valves move with the left's,
 * which they lead or trail by only a few hundredths of a second.
 */
export function HeartValves() {
  const { beat, clock } = usePulse();
  const leaflet = useTissue(LEAFLET_TISSUE);
  const cord = useTissue(CHORD_TISSUE);
  const inflow = useMemo(inflowSheets, []);
  const outflow = useMemo(outflowSheets, []);
  const chords = useMemo(inflowChords, []);
  const inflowMesh = useMemo(() => sheetGeometry(inflow), [inflow]);
  const outflowMesh = useMemo(() => sheetGeometry(outflow), [outflow]);
  const chordMesh = useMemo(() => chordGeometry(chords.length), [chords]);
  useEffect(
    () => () => {
      inflowMesh.dispose();
      outflowMesh.dispose();
      chordMesh.dispose();
    },
    [inflowMesh, outflowMesh, chordMesh]
  );

  useFrame(() => {
    const moment = momentAt(beat, clock.current);
    shape(inflowMesh, inflow, moment.mitral);
    shape(outflowMesh, outflow, moment.aortic);
    tie(chordMesh, chords, inflow, moment.mitral);
  });

  return (
    <group>
      <mesh geometry={inflowMesh} material={leaflet} />
      <mesh geometry={outflowMesh} material={leaflet} />
      <mesh geometry={chordMesh} material={cord} />
    </group>
  );
}
