import type { Spot } from "@repo/design-system/components/contents/physics/optics/ray";
import {
  blockPath,
  criticalAngle,
} from "@repo/design-system/components/contents/physics/optics/ray";
import { Beam, Glow } from "@repo/design-system/components/three/optic/beam";
import {
  Arc,
  BOARD_TALL,
  Board,
} from "@repo/design-system/components/three/optic/board";
import { extent } from "@repo/design-system/components/three/optic/extent";
import { Slab } from "@repo/design-system/components/three/optic/glass";
import { Pulse } from "@repo/design-system/components/three/optic/pulse";
import { RayBox } from "@repo/design-system/components/three/optic/source";
import { View } from "@repo/design-system/components/three/optic/view";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Option } from "effect";

/** The block the lab draws, in its own units: wider than deep, as a classroom block lies on the board. */
export const SHAPE = { height: 1, width: 1.6 } as const;

/** Where the ray enters the far face, in block units from its left face. */
export const ENTRY = 1;

/** How many scene units one block unit takes, and how thick the block is. */
const UNIT = 1.5;
const THICK = 0.3;

/** How far from the point of entry the slit of the ray box stands, in block units. */
const REACH = 1.05;

/** How high above the felt the beam runs: the middle of the block's thickness. */
const RISE = THICK / 2;

/** How far each drawn normal reaches either side of its face, and the radius of an angle's arc. */
const NORMAL = 0.5;
const ARC = 0.3;

/** Seconds a light pulse takes to run the whole path. */
const PULSE_SECONDS = 2.6;

const DEGREE = Math.PI / 180;

/** How far behind its slit the ray box reaches, and how much room the view leaves round the path of the ray. */
const BOX_LONG = 0.62;
const ROOM = 0.28;

/** The side the board is read from: from above its near edge, close to a plan of the ray. */
const FROM = [0, 6, 2.1] as const;

/** The corners of the block, in its own frame. */
const CORNERS = [
  { x: 0, y: 0 },
  { x: SHAPE.width, y: 0 },
  { x: SHAPE.width, y: SHAPE.height },
  { x: 0, y: SHAPE.height },
] as const;

/** The direction, in radians on the page of the board, of the inward normal of each face. */
const INWARD = { bottom: Math.PI / 2, left: 0, right: Math.PI } as const;

/** A place in the block's frame as a point of the scene, at the height the beam runs. */
function place(spot: Spot) {
  return [
    (spot.x - SHAPE.width / 2) * UNIT,
    BOARD_TALL + RISE,
    (SHAPE.height / 2 - spot.y) * UNIT,
  ] as const;
}

/** The place `length` from `spot` in the direction `angle` on the page of the board. */
function toward(spot: Spot, angle: number, length: number) {
  return place({
    x: spot.x + (Math.cos(angle) * length) / UNIT,
    y: spot.y + (Math.sin(angle) * length) / UNIT,
  });
}

/** The dashed normal of a face through `spot`, along the direction `angle`. */
function Normal({
  angle,
  spot,
}: {
  readonly angle: number;
  readonly spot: Spot;
}) {
  return (
    <Beam
      color={INSTRUMENT_COLORS.paper}
      dashed
      points={[toward(spot, angle, -NORMAL), toward(spot, angle, NORMAL)]}
      strength={0.7}
      width={0.006}
    />
  );
}

/**
 * The face the ray meets first inside the glass: its normal, the arc of the
 * angle the ray makes with it, and a dashed line at the critical angle on
 * the same side, which the ray is past when the face reflects it.
 */
function Decision({
  critical,
  entry,
  hit,
}: {
  readonly critical: number;
  readonly entry: Spot;
  readonly hit: ReturnType<typeof blockPath>["hits"][number];
}) {
  const into = INWARD[hit.face];
  const back = Math.atan2(entry.y - hit.at.y, entry.x - hit.at.x);
  const turn = Math.atan2(Math.sin(back - into), Math.cos(back - into));
  const [x, y, z] = place(hit.at);

  return (
    <group>
      <Normal angle={into} spot={hit.at} />
      <group position={[x, y, z]}>
        <Arc
          color={
            hit.event === "reflected" ? PLOT_COLORS.pink : PLOT_COLORS.violet
          }
          from={into}
          radius={ARC}
          to={into + turn}
        />
      </group>
      <Beam
        color={PLOT_COLORS.pink}
        dashed
        points={[
          place(hit.at),
          toward(hit.at, into + Math.sign(turn || 1) * critical, 0.7),
        ]}
        strength={0.9}
        width={0.007}
      />
    </group>
  );
}

/**
 * A ray box on the felt baseboard of a ray optics kit aims a narrow beam at
 * the far face of a rectangular glass block. The beam is traced by Snell's
 * law through every face it meets, so it bends toward the normal going in,
 * and at the next face it either leaves or, past the critical angle, is
 * totally reflected back into the glass. The marks on the board are the
 * normals, the angles of incidence and refraction, and the critical angle.
 * The view holds the block and the whole path of the ray, from the ray box
 * to where the light ends, and follows the path as the ray is turned.
 */
export function BlockScene({
  incidence,
  index,
}: {
  /** The angle of incidence on the far face, in degrees. */
  readonly incidence: number;
  /** The refractive index of the glass. */
  readonly index: number;
}) {
  const ray = blockPath({ ...SHAPE, index }, ENTRY, incidence, REACH);
  const entry = { x: ENTRY, y: SHAPE.height };
  const points = Arr.map(ray.path, place);
  const source = points[0] ?? place(entry);
  const [x, y, z] = place(entry);
  const end = Arr.last(points);
  const lamp = toward(
    entry,
    Math.PI / 2 + incidence * DEGREE,
    REACH * UNIT + BOX_LONG
  );

  return (
    <View
      box={extent(
        [lamp, place(ray.mirror), ...points, ...Arr.map(CORNERS, place)],
        ROOM
      )}
      from={FROM}
    >
      <group position={[0, 0, -0.35]}>
        <Board deep={6.4} wide={6.6} />
      </group>
      <group position={[0, BOARD_TALL, 0]}>
        <Slab
          deep={SHAPE.height * UNIT}
          tall={THICK}
          wide={SHAPE.width * UNIT}
        />
      </group>
      <group
        position={[source[0], source[1], source[2]]}
        rotation={[0, incidence * DEGREE - Math.PI / 2, 0]}
      >
        <RayBox color={INSTRUMENT_COLORS.laserBeam} rise={RISE} />
      </group>
      <Beam
        color={INSTRUMENT_COLORS.laserBeam}
        points={points}
        strength={0.95}
        width={0.014}
      />
      <Beam
        color={INSTRUMENT_COLORS.laserBeam}
        points={[place(entry), place(ray.mirror)]}
        strength={0.16}
        width={0.012}
      />
      <Pulse
        color={INSTRUMENT_COLORS.laserBeam}
        points={points}
        seconds={PULSE_SECONDS}
        size={0.34}
      />
      {Option.match(end, {
        onNone: () => null,
        onSome: (spot) => (
          <group
            position={[spot[0], BOARD_TALL + 0.006, spot[2]]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <Glow
              color={INSTRUMENT_COLORS.laserBeam}
              size={0.5}
              strength={0.35}
            />
          </group>
        ),
      })}
      <Normal angle={Math.PI / 2} spot={entry} />
      <group position={[x, y, z]}>
        <Arc
          color={PLOT_COLORS.amber}
          from={Math.PI / 2}
          radius={ARC}
          to={Math.PI / 2 + incidence * DEGREE}
        />
        <Arc
          color={PLOT_COLORS.teal}
          from={-Math.PI / 2}
          radius={ARC}
          to={-Math.PI / 2 + ray.refraction * DEGREE}
        />
      </group>
      {Option.match(Arr.head(ray.hits), {
        onNone: () => null,
        onSome: (hit) => (
          <Decision
            critical={criticalAngle(index) * DEGREE}
            entry={entry}
            hit={hit}
          />
        ),
      })}
    </View>
  );
}
