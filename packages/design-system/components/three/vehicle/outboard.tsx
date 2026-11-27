import { RoundedBox } from "@react-three/drei";
import type { Surface } from "@repo/design-system/components/three/surface/detail";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { Strake } from "@repo/design-system/components/three/vessel/strake";
import { BOAT_COLORS } from "@repo/design-system/lib/material/boat";
import { Array as Arr } from "effect";
import type { RefObject } from "react";
import { useEffect, useMemo } from "react";
import type { Group } from "three";
import { ExtrudeGeometry, LatheGeometry, Shape, Vector2 } from "three";

type Outline = readonly (readonly [number, number])[];
type Place = readonly [number, number, number];

/** The engine cover: a rounded cowl, fullest at its shoulders. */
const COWL: Outline = [
  [0, 0.985],
  [0.07, 0.978],
  [0.125, 0.945],
  [0.15, 0.87],
  [0.156, 0.76],
  [0.142, 0.69],
  [0.122, 0.662],
];

/** The bright band where the cowl meets the lower cover. */
const BAND: Outline = [
  [0.121, 0.664],
  [0.128, 0.645],
  [0.121, 0.626],
];

/** The lower cover and the leg: a streamlined strut down to the plate. */
const LEG: Outline = [
  [0.12, 0.628],
  [0.092, 0.5],
  [0.07, 0.3],
  [0.06, 0.02],
];

/** The anti-ventilation plate over the propeller. */
const PLATE: Outline = [
  [0, 0.03],
  [0.13, 0.028],
  [0.136, 0.02],
  [0, 0.012],
];

/** The gearcase: a torpedo with a blunt nose and a tail the propeller sits on. */
const GEARCASE: Outline = [
  [0, 0],
  [0.03, 0.008],
  [0.055, 0.08],
  [0.06, 0.2],
  [0.05, 0.34],
  [0.03, 0.42],
  [0.028, 0.44],
];

/** One blade of the propeller: a thin, cupped leaf. */
const BLADE: Outline = [
  [0, 0.011],
  [0.06, 0.008],
  [0.082, 0],
  [0.06, -0.008],
  [0, -0.011],
];

/** The propeller's hub. */
const HUB: Outline = [
  [0.028, 0],
  [0.034, 0.03],
  [0.03, 0.09],
  [0.012, 0.13],
  [0, 0.135],
];

/** The tiller from the engine forward to the helm's hand, and its rubber grip. */
const TILLER: readonly Place[] = [
  [-0.2, 0.7, 0],
  [0.05, 0.69, -0.02],
  [0.32, 0.62, -0.08],
  [0.6, 0.53, -0.15],
];
const GRIP: readonly Place[] = [
  [0.46, 0.576, -0.115],
  [0.53, 0.553, -0.133],
  [0.61, 0.527, -0.152],
];

/** The turned parts of the engine, each an outline stretched fore and aft. */
const TURNED = [
  {
    coat: 0.8,
    color: BOAT_COLORS.cowling,
    key: "cowl",
    outline: COWL,
    position: [-0.27, 0, 0],
    rotation: [0, 0, 0],
    scale: [1.55, 1, 0.8],
    surface: "plastic",
  },
  {
    coat: 0.3,
    color: BOAT_COLORS.cowlingBand,
    key: "band",
    outline: BAND,
    position: [-0.27, 0, 0],
    rotation: [0, 0, 0],
    scale: [1.55, 1, 0.8],
    surface: "brushed",
  },
  {
    coat: 0.3,
    color: BOAT_COLORS.cowlingBand,
    key: "leg",
    outline: LEG,
    position: [-0.27, 0, 0],
    rotation: [0, 0, 0],
    scale: [1.5, 1, 0.55],
    surface: "paint",
  },
  {
    coat: 0.3,
    color: BOAT_COLORS.cowlingBand,
    key: "plate",
    outline: PLATE,
    position: [-0.34, 0, 0],
    rotation: [0, 0, 0],
    scale: [1.9, 1, 0.75],
    surface: "paint",
  },
  {
    coat: 0.3,
    color: BOAT_COLORS.cowlingBand,
    key: "gearcase",
    outline: GEARCASE,
    position: [-0.1, -0.2, 0],
    rotation: [0, 0, Math.PI / 2],
    scale: [1, 1, 1],
    surface: "paint",
  },
] as const;

/** A solid of revolution from an outline of half-widths at heights. */
function Turned({
  coat,
  color,
  outline,
  position,
  rotation,
  scale,
  surface,
}: {
  readonly coat: number;
  readonly color: string;
  readonly outline: Outline;
  readonly position: Place;
  readonly rotation: Place;
  readonly scale: Place;
  readonly surface: Surface;
}) {
  const geometry = useMemo(
    () =>
      new LatheGeometry(
        Arr.map(outline, ([radius, height]) => new Vector2(radius, height)),
        32
      ),
    [outline]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      castShadow
      geometry={geometry}
      position={position}
      rotation={rotation}
      scale={scale}
    >
      <SurfaceMaterial
        coat={coat}
        color={color}
        repeat={[3, 2]}
        roughness={0.4}
        surface={surface}
      />
    </mesh>
  );
}

/** The skeg under the gearcase, which guards the propeller and steadies the stern. */
function Skeg() {
  const geometry = useMemo(() => {
    const outline = new Shape();
    outline.moveTo(-0.18, -0.25);
    outline.lineTo(-0.42, -0.25);
    outline.quadraticCurveTo(-0.44, -0.36, -0.5, -0.4);
    outline.quadraticCurveTo(-0.34, -0.37, -0.18, -0.25);
    return new ExtrudeGeometry(outline, {
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.004,
      bevelThickness: 0.004,
      depth: 0.008,
    });
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh castShadow geometry={geometry} position={[0, 0, -0.004]}>
      <SurfaceMaterial
        color={BOAT_COLORS.cowlingBand}
        repeat={[2, 2]}
        roughness={0.4}
        surface="paint"
      />
    </mesh>
  );
}

/**
 * A small outboard engine hung on a transom, at real size, in metres, with
 * its origin at the transom's foot on the centreline and the engine astern
 * of it, toward -x: a glossy cowl over a bright band, the leg down to the
 * anti-ventilation plate, the gearcase with its skeg and three-bladed
 * propeller, the clamp bracket on the transom, and the tiller reaching
 * forward to the helm's hand.
 *
 * @param propeller - The propeller's group, which the boat turns as it drives
 */
export function Outboard({
  propeller,
}: {
  readonly propeller: RefObject<Group | null>;
}) {
  return (
    <group>
      {Arr.map(TURNED, (part) => (
        <Turned
          coat={part.coat}
          color={part.color}
          key={part.key}
          outline={part.outline}
          position={part.position}
          rotation={part.rotation}
          scale={part.scale}
          surface={part.surface}
        />
      ))}
      <RoundedBox
        args={[0.13, 0.26, 0.3]}
        castShadow
        position={[-0.05, 0.56, 0]}
        radius={0.025}
        smoothness={3}
      >
        <SurfaceMaterial
          color={BOAT_COLORS.cowlingBand}
          metalness={1}
          repeat={[2, 2]}
          roughness={0.45}
          surface="cast"
        />
      </RoundedBox>
      <Skeg />
      <group position={[-0.54, -0.2, 0]} ref={propeller}>
        <Turned
          coat={0}
          color={BOAT_COLORS.cowlingBand}
          outline={HUB}
          position={[0, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
          scale={[1, 1, 1]}
          surface="brushed"
        />
        {Arr.map([0, 1, 2], (blade) => (
          <group
            key={blade}
            position={[-0.06, 0, 0]}
            rotation={[(blade * Math.PI * 2) / 3, 0, 0]}
          >
            <Turned
              coat={0}
              color={BOAT_COLORS.cowlingBand}
              outline={BLADE}
              position={[0, 0.085, 0]}
              rotation={[0.5, 0, Math.PI / 2]}
              scale={[1, 1, 0.62]}
              surface="brushed"
            />
          </group>
        ))}
      </group>
      <Strake
        color={BOAT_COLORS.cowling}
        points={TILLER}
        radius={0.015}
        surface="plastic"
      />
      <Strake
        color={BOAT_COLORS.gunwale}
        points={GRIP}
        radius={0.021}
        surface="rubber"
      />
    </group>
  );
}
