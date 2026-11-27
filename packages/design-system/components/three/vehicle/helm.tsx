import type { Surface } from "@repo/design-system/components/three/surface/detail";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { BOAT_COLORS } from "@repo/design-system/lib/material/boat";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { LatheGeometry, Quaternion, Vector2, Vector3 } from "three";

type Place = readonly [number, number, number];
type Outline = readonly (readonly [number, number])[];

const UP = new Vector3(0, 1, 0);

/** A limb's outline along its length: rounded at both ends, fullest a third along. */
const LIMB: Outline = [
  [0, 0],
  [0.55, 0.012],
  [0.86, 0.045],
  [1, 0.12],
  [1.05, 0.32],
  [1, 0.62],
  [1, 0.88],
  [0.86, 0.955],
  [0.5, 0.99],
  [0, 1],
];

/** The trunk from the seat to the neck, as half-widths at heights, in metres. */
const TRUNK: Outline = [
  [0, 0],
  [0.13, 0.005],
  [0.178, 0.07],
  [0.16, 0.2],
  [0.186, 0.38],
  [0.2, 0.47],
  [0.15, 0.535],
  [0.062, 0.575],
  [0.054, 0.66],
];

/** The buoyancy vest over the trunk: thick foam panels from the waist to the shoulders. */
const VEST: Outline = [
  [0.15, 0.17],
  [0.2, 0.175],
  [0.222, 0.3],
  [0.226, 0.44],
  [0.2, 0.52],
  [0.13, 0.56],
  [0.095, 0.555],
];

/** The head from the chin to the crown. */
const HEAD: Outline = [
  [0, 0.645],
  [0.045, 0.652],
  [0.074, 0.69],
  [0.088, 0.745],
  [0.093, 0.8],
  [0.084, 0.85],
  [0.055, 0.882],
  [0, 0.893],
];

/** The crown of a peaked cap, pulled down to the brow. */
const CAP: Outline = [
  [0.096, 0.795],
  [0.098, 0.835],
  [0.086, 0.875],
  [0.05, 0.9],
  [0, 0.906],
];

/** The cap's peak, a thin board lathed flat and stretched forward. */
const PEAK: Outline = [
  [0, 0.8],
  [0.085, 0.797],
  [0.092, 0.79],
  [0, 0.786],
];

/** The parts of the body that are turned: each an outline, flattened front to back. */
const TURNED = [
  {
    color: BOAT_COLORS.shirt,
    key: "trunk",
    outline: TRUNK,
    position: [0, 0, 0],
    scale: [0.62, 1, 1],
    surface: "cloth",
  },
  {
    color: BOAT_COLORS.lifeVest,
    key: "vest",
    outline: VEST,
    position: [0, 0, 0],
    scale: [0.72, 1, 1],
    surface: "cloth",
  },
  {
    color: BOAT_COLORS.skin,
    key: "head",
    outline: HEAD,
    position: [0.01, 0, 0],
    scale: [1.06, 1, 0.9],
    surface: "tissue",
  },
  {
    color: BOAT_COLORS.hair,
    key: "cap",
    outline: CAP,
    position: [0.01, 0, 0],
    scale: [1.06, 1, 0.92],
    surface: "cloth",
  },
  {
    color: BOAT_COLORS.hair,
    key: "peak",
    outline: PEAK,
    position: [0.1, 0, 0],
    scale: [1.15, 1, 0.82],
    surface: "cloth",
  },
] as const;

/** The two legs: a thigh along the seat, a shin down to the boards and a shoe on them. */
const LEGS = Arr.flatMap([1, -1], (side) => [
  {
    color: BOAT_COLORS.trousers,
    from: [0.02, 0.085, side * 0.09],
    key: `thigh${side}`,
    surface: "cloth",
    thick: 0.085,
    thin: 0.062,
    to: [0.47, 0.11, side * 0.135],
  },
  {
    color: BOAT_COLORS.trousers,
    from: [0.45, 0.13, side * 0.135],
    key: `shin${side}`,
    surface: "cloth",
    thick: 0.062,
    thin: 0.042,
    to: [0.5, -0.27, side * 0.14],
  },
  {
    color: BOAT_COLORS.gunwale,
    from: [0.44, -0.285, side * 0.14],
    key: `shoe${side}`,
    surface: "rubber",
    thick: 0.05,
    thin: 0.04,
    to: [0.72, -0.295, side * 0.15],
  },
]) satisfies readonly LimbProps[];

/** The right arm, resting on the knee, and the left, reaching back to the tiller. */
const ARMS = [
  {
    color: BOAT_COLORS.shirt,
    from: [0, 0.49, 0.2],
    key: "upperRight",
    surface: "cloth",
    thick: 0.055,
    thin: 0.044,
    to: [0.12, 0.25, 0.25],
  },
  {
    color: BOAT_COLORS.skin,
    from: [0.11, 0.26, 0.25],
    key: "foreRight",
    surface: "tissue",
    thick: 0.042,
    thin: 0.03,
    to: [0.36, 0.17, 0.17],
  },
  {
    color: BOAT_COLORS.skin,
    from: [0.34, 0.172, 0.172],
    key: "handRight",
    surface: "tissue",
    thick: 0.034,
    thin: 0.026,
    to: [0.44, 0.158, 0.16],
  },
  {
    color: BOAT_COLORS.shirt,
    from: [0, 0.49, -0.2],
    key: "upperLeft",
    surface: "cloth",
    thick: 0.055,
    thin: 0.044,
    to: [-0.1, 0.27, -0.3],
  },
  {
    color: BOAT_COLORS.skin,
    from: [-0.09, 0.275, -0.3],
    key: "foreLeft",
    surface: "tissue",
    thick: 0.042,
    thin: 0.03,
    to: [-0.07, 0.19, -0.52],
  },
  {
    color: BOAT_COLORS.skin,
    from: [-0.07, 0.2, -0.5],
    key: "handLeft",
    surface: "tissue",
    thick: 0.036,
    thin: 0.028,
    to: [-0.07, 0.165, -0.59],
  },
] satisfies readonly LimbProps[];

/** Where the hand on the tiller closes, in the helm's own frame, in metres. */
const HELM_GRIP: Place = [-0.07, 0.16, -0.57];

interface LimbProps {
  readonly color: string;
  readonly from: Place;
  readonly key: string;
  readonly surface: Surface;
  readonly thick: number;
  readonly thin: number;
  readonly to: Place;
}

/** A solid of revolution from an outline of half-widths at heights. */
function Turned({
  color,
  outline,
  position,
  scale,
  surface,
}: {
  readonly color: string;
  readonly outline: Outline;
  readonly position: Place;
  readonly scale: Place;
  readonly surface: Surface;
}) {
  const geometry = useMemo(
    () =>
      new LatheGeometry(
        Arr.map(outline, ([radius, height]) => new Vector2(radius, height)),
        28
      ),
    [outline]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh castShadow geometry={geometry} position={position} scale={scale}>
      <SurfaceMaterial
        color={color}
        repeat={[4, 2]}
        roughness={0.85}
        surface={surface}
      />
    </mesh>
  );
}

/** A tapered, round-ended length of the body from one joint to the next. */
function Limb({
  color,
  from,
  surface,
  thick,
  thin,
  to,
}: Omit<LimbProps, "key">) {
  const { geometry, turn } = useMemo(() => {
    const span = new Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    const length = span.length();
    return {
      geometry: new LatheGeometry(
        Arr.map(
          LIMB,
          ([radius, along]) =>
            new Vector2(
              radius * (thick + (thin - thick) * along),
              along * length
            )
        ),
        16
      ),
      turn: new Quaternion().setFromUnitVectors(UP, span.normalize()),
    };
  }, [from, thick, thin, to]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh castShadow geometry={geometry} position={from} quaternion={turn}>
      <SurfaceMaterial
        color={color}
        repeat={[2, 3]}
        roughness={0.8}
        surface={surface}
      />
    </mesh>
  );
}

/**
 * The person at a small boat's helm, at real size, in metres: seated facing
 * +x with the origin on the seat under the hips, in a shirt, trousers, a
 * buoyancy vest and a peaked cap, the left hand closed on the tiller at
 * `HELM_GRIP` and the right resting on the knee.
 */
export function Helm() {
  return (
    <group>
      {Arr.map(TURNED, (part) => (
        <Turned
          color={part.color}
          key={part.key}
          outline={part.outline}
          position={part.position}
          scale={part.scale}
          surface={part.surface}
        />
      ))}
      {Arr.map(Arr.appendAll(LEGS, ARMS), (limb) => (
        <Limb
          color={limb.color}
          from={limb.from}
          key={limb.key}
          surface={limb.surface}
          thick={limb.thick}
          thin={limb.thin}
          to={limb.to}
        />
      ))}
    </group>
  );
}
