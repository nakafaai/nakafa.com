import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import type { Material } from "three";
import {
  DoubleSide,
  ExtrudeGeometry,
  LatheGeometry,
  Path,
  Shape,
  Vector2,
} from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * A passenger car's road wheel at real size, in metres, turning about z with
 * its outer face toward +z: a 225/45 R17 tyre, 0.68 m across, on a 17 inch
 * alloy rim, over a 330 mm ventilated brake disc.
 */
export const WHEEL = {
  /** Where the spokes' face sits along the axle, toward the kerb. */
  face: 0.078,
  /** The radius of the circle the five wheel nuts stand on (5 x 114.3 mm). */
  lugCircle: 0.057,
  radius: 0.34,
  rim: 0.216,
  width: 0.225,
} as const;

/** The brake disc inside the rim: 330 mm across, two 9 mm plates on 10 mm vanes. */
export const DISC = {
  hat: 0.092,
  plate: 0.009,
  radius: 0.165,
  vane: 0.01,
} as const;

/** The parts of a wheel a lab may repaint, such as a thermal camera's view. */
type WheelPart = "caliper" | "disc" | "rim" | "tyre";

/** The materials that replace a wheel's own, one per repainted part. */
type WheelPaint = Partial<Record<WheelPart, Material>>;

/** The tread's four circumferential grooves, from the wheel's middle. */
const GROOVES = [-0.052, -0.018, 0.018, 0.052] as const;
const GROOVE = { depth: 0.007, half: 0.0045 } as const;

/**
 * The tyre's cross section from the inner bead over the tread to the outer
 * bead: bulging sidewalls, rounded shoulders, and a flat tread cut by four
 * grooves that carry water out from under the contact patch.
 */
function tyreProfile() {
  const half = WHEEL.width / 2;
  const inner = [
    [WHEEL.rim - 0.002, -half + 0.022],
    [WHEEL.rim + 0.02, -half + 0.004],
    [WHEEL.rim + 0.068, -half],
    [WHEEL.radius - 0.02, -half + 0.01],
    [WHEEL.radius - 0.006, -half + 0.024],
    [WHEEL.radius, -half + 0.036],
  ] as const;
  const tread = Arr.flatMap(GROOVES, (at) => [
    [WHEEL.radius, at - GROOVE.half - 0.001],
    [WHEEL.radius - GROOVE.depth, at - GROOVE.half],
    [WHEEL.radius - GROOVE.depth, at + GROOVE.half],
    [WHEEL.radius, at + GROOVE.half + 0.001],
  ]);
  const outer = Arr.map(
    Arr.reverse(inner),
    ([radius, side]) => [radius, -side] as const
  );
  return Arr.map(
    [...inner, ...tread, ...outer],
    ([radius, side]) => new Vector2(radius, side)
  );
}

/**
 * The rim's barrel from its inner lip to its outer lip: two bead seats, the
 * drop centre a tyre is levered over, and the rolled lips that hold the beads.
 */
function barrelProfile() {
  const half = WHEEL.width / 2;
  return Arr.map(
    [
      [WHEEL.rim + 0.01, -half + 0.012],
      [WHEEL.rim + 0.004, -half + 0.02],
      [WHEEL.rim - 0.006, -half + 0.03],
      [WHEEL.rim - 0.022, -0.02],
      [WHEEL.rim - 0.022, 0.04],
      [WHEEL.rim - 0.006, half - 0.03],
      [WHEEL.rim + 0.004, half - 0.02],
      [WHEEL.rim + 0.01, half - 0.012],
      [WHEEL.rim + 0.006, half - 0.006],
    ] as const,
    ([radius, side]) => new Vector2(radius, side)
  );
}

/** Turns a lathed profile from the lathe's y axis onto the axle, z. */
function lathe(profile: readonly Vector2[], segments: number) {
  const geometry = new LatheGeometry([...profile], segments);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

/** A point of the wheel's face at `radius` and `turn` from +x. */
function polar(radius: number, turn: number) {
  return new Vector2(Math.cos(turn) * radius, Math.sin(turn) * radius);
}

/**
 * The alloy's face: five twin spokes cut from one disc by five windows and a
 * slot down each spoke, with a flat machined face.
 */
function spokeGeometry() {
  const outer = WHEEL.rim - 0.008;
  const gap = { inner: 0.086, outer: outer - 0.024, spoke: 0.031 } as const;
  const face = new Shape();
  face.absarc(0, 0, outer, 0, Math.PI * 2, false);
  // Each spoke pair leaves a window to the next pair and a slot down its middle.
  face.holes = Arr.flatMap(Arr.range(0, 4), (index) => {
    const from = (index / 5) * Math.PI * 2 + Math.PI / 2;
    const to = from + (Math.PI * 2) / 5;
    const wide = Math.asin(gap.spoke / gap.outer);
    const narrow = Math.asin(gap.spoke / gap.inner);
    const rim = Arr.makeBy(9, (step) =>
      polar(gap.outer, from + wide + ((to - from - 2 * wide) * step) / 8)
    );
    const hub = Arr.makeBy(5, (step) =>
      polar(gap.inner, to - narrow - ((to - from - 2 * narrow) * step) / 4)
    );
    const along = polar(1, from);
    const across = polar(0.0075, from + Math.PI / 2);
    return [
      new Path([...rim, ...hub]),
      new Path([
        along.clone().multiplyScalar(0.104).add(across),
        along
          .clone()
          .multiplyScalar(outer - 0.03)
          .add(across),
        along
          .clone()
          .multiplyScalar(outer - 0.03)
          .sub(across),
        along.clone().multiplyScalar(0.104).sub(across),
      ]),
    ];
  });
  const geometry = new ExtrudeGeometry(face, {
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.003,
    bevelThickness: 0.003,
    curveSegments: 40,
    depth: 0.014,
  });
  geometry.translate(0, 0, WHEEL.face - 0.014);
  return toCreasedNormals(geometry, Math.PI / 6);
}

/**
 * One friction plate of the disc: a ring cross-drilled with three spiral rows
 * of holes that let gas and dust escape from under the pads.
 */
function plateGeometry() {
  const ring = new Shape();
  ring.absarc(0, 0, DISC.radius, 0, Math.PI * 2, false);
  ring.holes = [
    new Path().absarc(0, 0, DISC.hat, 0, Math.PI * 2, true),
    ...Arr.map(Arr.range(0, 35), (index) => {
      const row = index % 3;
      const turn = (index / 36) * Math.PI * 2;
      const centre = polar(0.108 + row * 0.02, turn + row * 0.05);
      return new Path().absarc(
        centre.x,
        centre.y,
        0.0042,
        0,
        Math.PI * 2,
        true
      );
    }),
  ];
  return new ExtrudeGeometry(ring, {
    bevelEnabled: false,
    curveSegments: 48,
    depth: DISC.plate,
  });
}

/**
 * The caliper's body seen along the axle: a fixed monoblock that reaches
 * round a sixth of the disc and bridges over its edge.
 */
function caliperGeometry() {
  const span = { from: Math.PI * 0.62, to: Math.PI * 0.98 } as const;
  const body = new Shape();
  body.absarc(0, 0, WHEEL.rim - 0.034, span.from, span.to, false);
  body.absarc(0, 0, DISC.hat + 0.012, span.to, span.from, true);
  body.closePath();
  const geometry = new ExtrudeGeometry(body, {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.006,
    bevelThickness: 0.006,
    curveSegments: 24,
    depth: 0.062,
  });
  geometry.translate(0, 0, -0.031);
  return toCreasedNormals(geometry, Math.PI / 6);
}

/** A repainted part's material, or nothing so the part's own material shows. */
function Repaint({ material }: { readonly material: Material | undefined }) {
  if (material === undefined) {
    return null;
  }
  return <primitive attach="material" object={material} />;
}

/** Bare cast or machined metal, as the alloy and the iron of a wheel are. */
function WheelMetal({
  color,
  roughness,
}: {
  readonly color: string;
  readonly roughness: number;
}) {
  return (
    <SurfaceMaterial
      bump={0.25}
      color={color}
      metalness={1}
      repeat={[6, 1]}
      roughness={roughness}
      side={DoubleSide}
      surface="brushed"
    />
  );
}

/** The five wheel nuts and the studs they run on, round the hub's face. */
function LugNuts() {
  const seat = WHEEL.face + 0.008;
  return (
    <group>
      {Arr.map(Arr.range(0, 4), (index) => {
        const centre = polar(
          WHEEL.lugCircle,
          (index / 5) * Math.PI * 2 + Math.PI / 2 + Math.PI / 5
        );
        return (
          <group key={index} position={[centre.x, centre.y, seat]}>
            <mesh castShadow rotation={[Math.PI / 2, index * 0.4, 0]}>
              <cylinderGeometry args={[0.0105, 0.0125, 0.022, 6]} />
              <meshStandardMaterial
                color={CAR_COLORS.chrome}
                metalness={1}
                roughness={0.22}
              />
            </mesh>
            <mesh position={[0, 0, 0.012]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.006, 0.006, 0.006, 12]} />
              <meshStandardMaterial
                color={CAR_COLORS.hub}
                metalness={1}
                roughness={0.5}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/**
 * Everything of a road wheel that turns with the axle: the grooved tyre, the
 * alloy rim with its barrel, twin spokes, centre cap and nuts, and the
 * ventilated, cross-drilled brake disc on its hat behind the spokes.
 *
 * @param paint - Materials that replace the wheel's own, part by part
 */
export function WheelRotor({
  paint,
}: {
  readonly paint?: WheelPaint | undefined;
}) {
  const tyre = useMemo(() => lathe(tyreProfile(), 72), []);
  const barrel = useMemo(() => lathe(barrelProfile(), 64), []);
  const spokes = useMemo(spokeGeometry, []);
  const plate = useMemo(plateGeometry, []);
  useEffect(
    () => () => {
      tyre.dispose();
      barrel.dispose();
      spokes.dispose();
      plate.dispose();
    },
    [barrel, plate, spokes, tyre]
  );
  const hub = WHEEL.face;

  return (
    <group>
      <mesh castShadow geometry={tyre} receiveShadow>
        <Repaint material={paint?.tyre} />
        {paint?.tyre === undefined ? (
          <SurfaceMaterial
            bump={0.9}
            color={CAR_COLORS.tyre}
            repeat={[28, 2]}
            roughness={0.94}
            surface="rubber"
          />
        ) : null}
      </mesh>
      <mesh geometry={barrel}>
        <Repaint material={paint?.rim} />
        {paint?.rim === undefined ? (
          <WheelMetal color={CAR_COLORS.rimDark} roughness={0.45} />
        ) : null}
      </mesh>
      <mesh castShadow geometry={spokes}>
        <Repaint material={paint?.rim} />
        {paint?.rim === undefined ? (
          <WheelMetal color={CAR_COLORS.rimBright} roughness={0.3} />
        ) : null}
      </mesh>
      <mesh position={[0, 0, hub + 0.004]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.033, 0.012, 32]} />
        <meshStandardMaterial
          color={CAR_COLORS.hub}
          metalness={1}
          roughness={0.35}
        />
      </mesh>
      <LugNuts />
      {Arr.map([-DISC.vane / 2 - DISC.plate, DISC.vane / 2], (depth) => (
        <mesh geometry={plate} key={depth} position={[0, 0, depth]}>
          <Repaint material={paint?.disc} />
          {paint?.disc === undefined ? (
            <WheelMetal color={CAR_COLORS.castIron} roughness={0.42} />
          ) : null}
        </mesh>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry
          args={[DISC.radius - 0.006, DISC.radius - 0.006, DISC.vane, 48, 1]}
        />
        <Repaint material={paint?.disc} />
        {paint?.disc === undefined ? (
          <meshStandardMaterial
            color={CAR_COLORS.rimDark}
            metalness={0.8}
            roughness={0.7}
          />
        ) : null}
      </mesh>
      <mesh position={[0, 0, hub / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[DISC.hat, DISC.hat + 0.004, hub, 40]} />
        <Repaint material={paint?.disc} />
        {paint?.disc === undefined ? (
          <WheelMetal color={CAR_COLORS.hub} roughness={0.55} />
        ) : null}
      </mesh>
    </group>
  );
}

/**
 * The brake caliper, which stays with the suspension while the wheel turns:
 * a painted monoblock gripping the disc, with its two bridge bolts.
 *
 * @param paint - Materials that replace the caliper's own
 */
export function BrakeCaliper({
  paint,
}: {
  readonly paint?: WheelPaint | undefined;
}) {
  const body = useMemo(caliperGeometry, []);
  useEffect(() => () => body.dispose(), [body]);

  return (
    <group>
      <mesh castShadow geometry={body}>
        <Repaint material={paint?.caliper} />
        {paint?.caliper === undefined ? (
          <meshPhysicalMaterial
            clearcoat={1}
            clearcoatRoughness={0.12}
            color={CAR_COLORS.caliper}
            metalness={0.2}
            roughness={0.38}
          />
        ) : null}
      </mesh>
      {Arr.map([0.7, 0.9], (turn) => {
        const centre = polar(WHEEL.rim - 0.05, Math.PI * turn);
        return (
          <mesh
            key={turn}
            position={[centre.x, centre.y, 0.037]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.007, 0.007, 0.006, 6]} />
            <meshStandardMaterial
              color={CAR_COLORS.chrome}
              metalness={1}
              roughness={0.3}
            />
          </mesh>
        );
      })}
    </group>
  );
}
