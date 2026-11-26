import type { PetroleumFraction } from "@repo/design-system/components/contents/chemistry/fraction/model";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { ORGANIC_COLORS } from "@repo/design-system/lib/material/organic";
import { Array as Arr, Match } from "effect";
import { useEffect, useMemo } from "react";
import {
  CatmullRomCurve3,
  ExtrudeGeometry,
  Shape,
  TubeGeometry,
  Vector3,
} from "three";

/** Ordered fractions from lightest overhead gas to heaviest residue. */
export const ALL_FRACTIONS: readonly PetroleumFraction[] = [
  "refineryGas",
  "petrol",
  "kerosene",
  "diesel",
  "bitumen",
];

/** Benchtop Z plane for the distillation rig, in front of the reagent bottles. */
export const RIG_Z = 0.06;

/** Outer radius of the benchtop fractionating tower in metres. */
export const COLUMN_RADIUS = 0.076;

/** Maps a model tray height onto the 0.54 m tall benchtop column. */
export function benchTrayY(modelTrayY: number): number {
  return 0.08 + modelTrayY * 0.34;
}

/** Material colour assigned to each petroleum fraction. */
export function fractionHex(fraction: PetroleumFraction): string {
  return Match.value(fraction).pipe(
    Match.when("refineryGas", () => ORGANIC_COLORS.refineryCyan),
    Match.when("petrol", () => ORGANIC_COLORS.petrolYellow),
    Match.when("kerosene", () => ORGANIC_COLORS.keroseneOrange),
    Match.when("diesel", () => ORGANIC_COLORS.dieselAmber),
    Match.when("bitumen", () => ORGANIC_COLORS.bitumenBlack),
    Match.exhaustive
  );
}

/** Serpentine crude-oil coil winding through the furnace firebox and out to the column. */
function buildFurnaceCoilGeometry(): TubeGeometry {
  const curve = new CatmullRomCurve3([
    new Vector3(-0.34, 0.055, RIG_Z - 0.02),
    new Vector3(-0.31, 0.055, RIG_Z + 0.025),
    new Vector3(-0.23, 0.072, RIG_Z + 0.025),
    new Vector3(-0.23, 0.095, RIG_Z - 0.02),
    new Vector3(-0.31, 0.112, RIG_Z - 0.02),
    new Vector3(-0.31, 0.132, RIG_Z + 0.025),
    new Vector3(-0.22, 0.136, RIG_Z + 0.015),
    new Vector3(-0.15, 0.125, RIG_Z),
    new Vector3(-0.072, 0.115, RIG_Z),
  ]);
  return new TubeGeometry(curve, 64, 0.0085, 14, false);
}

/** Bevelled cast-iron arch surround for the recessed firebox viewport. */
function buildFireboxArchGeometry(): ExtrudeGeometry {
  const outer = new Shape();
  outer.moveTo(-0.058, 0);
  outer.lineTo(-0.058, 0.056);
  outer.absarc(0, 0.056, 0.058, Math.PI, 0, true);
  outer.lineTo(0.058, 0);
  outer.closePath();

  const hole = new Shape();
  hole.moveTo(-0.044, 0.008);
  hole.lineTo(-0.044, 0.054);
  hole.absarc(0, 0.054, 0.044, Math.PI, 0, true);
  hole.lineTo(0.044, 0.008);
  hole.closePath();
  outer.holes = [hole];

  return new ExtrudeGeometry(outer, {
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.003,
    bevelThickness: 0.003,
    depth: 0.012,
  });
}

const FURNACE_POSTS = [
  [-0.088, -0.08],
  [0.088, -0.08],
  [-0.088, 0.08],
  [0.088, 0.08],
] as const;

const EMBER_OFFSETS = [-0.028, 0, 0.028] as const;

/**
 * Refractory firebrick and dark steel crude-oil pre-heating furnace with an
 * arched firebox viewport, incandescent heating glow, chimney flue stub, and
 * serpentine stainless transfer coil feeding the column base.
 */
export function FurnaceUnit() {
  const coilGeo = useMemo(buildFurnaceCoilGeometry, []);
  const archGeo = useMemo(buildFireboxArchGeometry, []);

  useEffect(
    () => () => {
      coilGeo.dispose();
      archGeo.dispose();
    },
    [archGeo, coilGeo]
  );

  return (
    <group>
      <group position={[-0.27, 0, RIG_Z]}>
        <mesh castShadow position={[0, 0.009, 0]} receiveShadow>
          <boxGeometry args={[0.195, 0.018, 0.18]} />
          <MetalMaterial color={CAR_COLORS.rimDark} roughness={0.65} />
        </mesh>
        <mesh castShadow position={[0, 0.104, 0]} receiveShadow>
          <boxGeometry args={[0.172, 0.172, 0.158]} />
          <meshStandardMaterial color={BENCH_COLORS.brick} roughness={0.86} />
        </mesh>
        <mesh position={[0, 0.086, 0.066]}>
          <boxGeometry args={[0.092, 0.1, 0.032]} />
          <meshStandardMaterial color={BENCH_COLORS.coals} roughness={0.95} />
        </mesh>
        {Arr.map(EMBER_OFFSETS, (dx) => (
          <mesh key={dx} position={[dx, 0.048, 0.072]}>
            <sphereGeometry args={[0.016, 14, 12]} />
            <meshStandardMaterial
              color={BENCH_COLORS.coalGlow}
              emissive={BENCH_COLORS.coalGlow}
              emissiveIntensity={1.35}
              roughness={0.35}
            />
          </mesh>
        ))}
        <mesh
          castShadow
          geometry={archGeo}
          position={[0, 0.034, 0.077]}
          receiveShadow
        >
          <MetalMaterial color={CAR_COLORS.rimDark} roughness={0.55} />
        </mesh>
        {Arr.map(FURNACE_POSTS, ([px, pz]) => (
          <mesh castShadow key={`${px}-${pz}`} position={[px, 0.104, pz]}>
            <boxGeometry args={[0.012, 0.178, 0.012]} />
            <MetalMaterial color={CAR_COLORS.castIron} roughness={0.5} />
          </mesh>
        ))}
        <mesh castShadow position={[0, 0.195, 0]}>
          <boxGeometry args={[0.192, 0.012, 0.176]} />
          <MetalMaterial color={CAR_COLORS.rimDark} roughness={0.52} />
        </mesh>
        <mesh castShadow position={[-0.03, 0.236, -0.025]}>
          <cylinderGeometry args={[0.018, 0.021, 0.072, 20]} />
          <MetalMaterial color={CAR_COLORS.rimDark} roughness={0.52} />
        </mesh>
        <mesh position={[-0.03, 0.275, -0.025]}>
          <coneGeometry args={[0.029, 0.014, 20]} />
          <MetalMaterial color={CAR_COLORS.castIron} roughness={0.45} />
        </mesh>
      </group>
      <mesh castShadow geometry={coilGeo}>
        <MetalMaterial color={BENCH_COLORS.probeSteel} roughness={0.28} />
      </mesh>
      <mesh position={[-0.088, 0.115, RIG_Z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.018, 0.018, 0.008, 20]} />
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.45} />
      </mesh>
      <mesh
        position={[-0.178, 0.13, RIG_Z + 0.006]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.018, 0.018, 0.008, 20]} />
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.45} />
      </mesh>
    </group>
  );
}
