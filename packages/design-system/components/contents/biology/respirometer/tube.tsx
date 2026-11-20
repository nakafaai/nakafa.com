import { Instances } from "@repo/design-system/components/contents/biology/instances";
import {
  arc,
  BOILING_TUBE,
  BoilingTube,
  CAPILLARY,
  ClearGlass,
  TUBE_BORE,
  TubeLiquid,
  useLathe,
} from "@repo/design-system/components/contents/biology/respirometer/glass";
import { SeedPile } from "@repo/design-system/components/contents/biology/respirometer/seeds";
import { ResetValve } from "@repo/design-system/components/contents/biology/respirometer/valve";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { RESPIROMETER_COLORS } from "@repo/design-system/lib/material/respirometer";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { CatmullRomCurve3, Vector3 } from "three";

/**
 * A size 4 rubber bung, which fits a 25 mm boiling tube, in metres: 20 mm
 * across its foot, 26 mm across its top, 25 mm tall (Eisco CH0321G2H). This
 * one is bored with two holes.
 */
export const BUNG = { foot: 0.01, height: 0.025, top: 0.013 } as const;

/** How far into the tube the bung is pushed: down to where it is as wide as the bore, in metres. */
const BUNG_SEAT =
  ((TUBE_BORE - 0.000_05 - BUNG.foot) / (BUNG.top - BUNG.foot)) * BUNG.height;

/** Where the bung's foot stands in the tube, and its top, in metres above the tube's foot. */
const BUNG_FOOT = BOILING_TUBE.length - BUNG_SEAT;
const BUNG_TOP = BUNG_FOOT + BUNG.height;

/** Where the capillary and the reset tube pass through the bung, across the tube, in metres. */
export const HOLES = { capillary: 0.0052, reset: -0.0055 } as const;

/** How high the wire gauze platform stands above the inside of the tube's round foot, in metres, clear of the solution. */
const GAUZE_HEIGHT = 0.026;

/**
 * How many germinating mung beans each tube holds: 60, about 1.7 g at
 * 28.19 g a thousand seeds (Nimkar and Chattopadhyay 2001), piled about
 * 2.5 cm deep on the gauze.
 */
const SEEDS = { count: 60, depth: 0.025 } as const;

/** The rubber bung, its edges rounded, turned from its foot. */
const BUNG_OUTLINE = [
  [0, 0],
  ...arc(BUNG.foot - 0.001, 0.001, 0.001, -Math.PI / 2, 0, 4),
  ...arc(BUNG.top - 0.0012, BUNG.height - 0.0012, 0.0012, 0, Math.PI / 2, 4),
  [0, BUNG.height],
] as const;

/**
 * One respirometer, standing at its tube's foot: a boiling tube with its
 * clear solution `depth` deep in its foot, a wire gauze platform above it
 * carrying germinating mung beans, and a two-holed rubber bung, through
 * which pass the capillary drawn as `children` and a short glass tube whose
 * rubber sleeve a screw clip closes.
 */
export function Respirometer({
  children,
  depth,
  salt,
}: {
  readonly children: ReactNode;
  readonly depth: number;
  readonly salt: number;
}) {
  const floor = BOILING_TUBE.wall + GAUZE_HEIGHT;
  return (
    <group>
      <TubeLiquid depth={depth} rise={0.0012} />
      <group position={[0, floor, 0]}>
        <Gauze />
      </group>
      <SeedPile
        ceiling={floor + SEEDS.depth}
        count={SEEDS.count}
        floor={floor + 0.0007}
        radius={TUBE_BORE - 0.0002}
        salt={salt}
      />
      <BoilingTube />
      <group position={[0, BUNG_FOOT, 0]}>
        <Bung />
      </group>
      {children}
      <group
        position={[HOLES.reset, BUNG_TOP, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <ResetValve />
      </group>
    </group>
  );
}

/** The two-holed rubber bung. */
function Bung() {
  const geometry = useLathe(BUNG_OUTLINE, 36);
  return (
    <mesh castShadow geometry={geometry} receiveShadow>
      <meshPhysicalMaterial
        clearcoat={0.15}
        clearcoatRoughness={0.6}
        color={RESPIROMETER_COLORS.rubber}
        roughness={0.78}
      />
    </mesh>
  );
}

/** How far apart the gauze's wires run, and how thick each is, in metres. */
const MESH = { pitch: 0.0016, wire: 0.000_36 } as const;

/**
 * A disc of woven wire gauze wedged across the tube as a platform: two
 * layers of wires at right angles, each cut to the chord of the bore it
 * crosses, drawn as one instanced mesh inside a crimped rim.
 */
function Gauze() {
  const span = TUBE_BORE - 0.0003;
  const steps = Math.floor(span / MESH.pitch);
  const wires = Arr.flatMap([0, 1] as const, (layer) =>
    Arr.flatMap(Arr.range(-steps, steps), (step) => {
      const offset = step * MESH.pitch;
      const chord = 2 * Math.sqrt(span ** 2 - offset ** 2);
      return chord < MESH.pitch
        ? []
        : [
            layer === 0
              ? {
                  position: [0, MESH.wire / 2, offset] as const,
                  rotation: [0, 0, Math.PI / 2] as const,
                  scale: [1, chord, 1] as const,
                }
              : {
                  position: [offset, MESH.wire * 1.4, 0] as const,
                  rotation: [Math.PI / 2, 0, 0] as const,
                  scale: [1, chord, 1] as const,
                },
          ];
    })
  );
  return (
    <group>
      <Instances placements={wires}>
        <cylinderGeometry args={[MESH.wire / 2, MESH.wire / 2, 1, 5]} />
        <MetalMaterial color={RESPIROMETER_COLORS.gauze} roughness={0.5} />
      </Instances>
      <mesh position={[0, MESH.wire, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[span - 0.0003, 0.0005, 6, 40]} />
        <MetalMaterial color={RESPIROMETER_COLORS.gauze} roughness={0.5} />
      </mesh>
    </group>
  );
}

/** The path of a capillary from inside the bung up to its bend at `rise` and `reach` along +x, sampled every few millimetres. */
function capillaryPath(rise: number, reach: number) {
  const x = HOLES.capillary;
  const riser = Arr.map(
    Arr.range(0, 8),
    (step) =>
      [
        x,
        BUNG_FOOT -
          0.002 +
          ((rise - CAPILLARY.bend - BUNG_FOOT + 0.002) * step) / 8,
      ] as const
  );
  const bend = Arr.drop(
    arc(
      x + CAPILLARY.bend,
      rise - CAPILLARY.bend,
      CAPILLARY.bend,
      Math.PI,
      Math.PI / 2,
      8
    ),
    1
  );
  const run = Arr.map(
    Arr.range(1, 16),
    (step) => [x + CAPILLARY.bend + (reach * step) / 16, rise] as const
  );
  return new CatmullRomCurve3(
    Arr.map(
      [...riser, ...bend, ...run],
      ([along, up]) => new Vector3(along, up, 0)
    ),
    false,
    "centripetal"
  );
}

/**
 * The bent capillary, in its tube's frame: thick-walled glass tubing that
 * rises from inside the bung, bends over at `rise` above the tube's foot and
 * runs `reach` along +x, its 1 mm bore showing as a bright thread down its
 * middle, open at its far end.
 */
export function Capillary({
  reach,
  rise,
}: {
  readonly reach: number;
  readonly rise: number;
}) {
  const path = useMemo(() => capillaryPath(rise, reach), [reach, rise]);
  return (
    <group>
      <mesh castShadow>
        <tubeGeometry args={[path, 160, CAPILLARY.radius, 16, false]} />
        <ClearGlass opacity={0.34} />
      </mesh>
      <mesh>
        <tubeGeometry args={[path, 160, CAPILLARY.bore, 8, false]} />
        <meshPhysicalMaterial
          color={RESPIROMETER_COLORS.enamel}
          opacity={0.55}
          roughness={0.1}
          transparent
        />
      </mesh>
      <mesh
        position={[HOLES.capillary + CAPILLARY.bend + reach, rise, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <ringGeometry args={[CAPILLARY.bore, CAPILLARY.radius, 20]} />
        <ClearGlass opacity={0.5} />
      </mesh>
    </group>
  );
}
