import type { PlantLifeCycle } from "@repo/design-system/components/contents/biology/growth/model";
import { Bloom } from "@repo/design-system/components/three/flora/bloom";
import { Soil } from "@repo/design-system/components/three/flora/soil";
import { Tree } from "@repo/design-system/components/three/flora/tree";
import { Turn } from "@repo/design-system/components/three/form/part";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { FLORA_COLORS } from "@repo/design-system/lib/material/flora";
import { DoubleSide } from "three";

/** The wall of a clay seed pan: a foot ring, a low flared side and a rolled rim. */
const PAN_PROFILE = [
  [0, 0.014],
  [0.1, 0.014],
  [0.102, 0.004],
  [0.5, 0],
  [0.535, 0.006],
  [0.552, 0.03],
  [0.585, 0.158],
  [0.598, 0.198],
  [0.628, 0.204],
  [0.64, 0.214],
  [0.643, 0.238],
  [0.636, 0.251],
  [0.617, 0.256],
  [0.601, 0.25],
  [0.594, 0.236],
  [0.588, 0.2],
  [0.572, 0.14],
] as const;

/** The plant each life cycle is drawn as, and the scale at which its full growth reaches the top of the stake. */
export const PLANTS = {
  annual: { habit: "herb", scale: 0.85 },
  biennial: { habit: "biennial", scale: 0.85 },
  perennial: { habit: "sapling", scale: 1.25 },
} as const;

/** How high the soil in the seed pan lies, where the plant roots and the stake's zero mark sits. */
export const SOIL_LEVEL = 0.235;

/** The seed as it lies on the soil before it roots: a plump bean turned about its long axis. */
const SEED_PROFILE = [
  [0, -0.04],
  [0.018, -0.036],
  [0.03, -0.024],
  [0.036, -0.006],
  [0.035, 0.012],
  [0.028, 0.028],
  [0.016, 0.038],
  [0, 0.041],
] as const;

/** How many steps the growth of the plant is drawn in, so it is rebuilt a few dozen times and not every frame. */
const STEPS = 56;

/** A wide clay seed pan of moist, crumbly soil for the plant to grow in. */
export function SoilPlanterBed() {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <Turn profile={PAN_PROFILE} />
        <SurfaceMaterial
          bump={0.9}
          color={FLORA_COLORS.potClay}
          repeat={[12, 2]}
          roughness={0.92}
          side={DoubleSide}
          surface="concrete"
        />
      </mesh>
      <group position={[0, 0.2, 0]}>
        <Soil count={1600} heap={0.055} radius={0.59} seed={5} />
      </group>
    </group>
  );
}

/**
 * The plant at one point of its growth curve: a seed that has just split its
 * coat, then a stem that lengthens node by node with a veined leaf at each,
 * a flower head at its tip once it flowers, and yellowed leaves when it dies
 * back. A perennial grows as a woody sapling that branches instead.
 */
export function GrowthPlantSpecimen({
  dryMass,
  hasFlower,
  isSenescent,
  lifeCycle,
}: {
  readonly dryMass: number;
  readonly hasFlower: boolean;
  readonly isSenescent: boolean;
  readonly lifeCycle: PlantLifeCycle;
}) {
  const plant = PLANTS[lifeCycle];
  const stage = Math.round(dryMass * STEPS) / STEPS;

  return (
    <group position={[0, SOIL_LEVEL, 0]}>
      {dryMass < 0.26 ? (
        <mesh
          castShadow
          position={[0.05, 0.016, 0.05]}
          rotation={[0.3, 0.4, 1.45]}
          scale={[1, 1, 0.78]}
        >
          <Turn profile={SEED_PROFILE} />
          <SurfaceMaterial
            bump={0.8}
            coat={0.3}
            color={FLORA_COLORS.seedCoat}
            repeat={[2, 2]}
            roughness={0.6}
            surface="wood"
          />
        </mesh>
      ) : null}
      <group scale={plant.scale}>
        <Tree aged={isSenescent} habit={plant.habit} seed={3} stage={stage}>
          {hasFlower ? (
            <group rotation={[0.5, 0.4, 0]}>
              <Bloom
                open={isSenescent ? 0.75 : 1}
                radius={0.05 + stage * 0.035}
              />
            </group>
          ) : null}
        </Tree>
      </group>
    </group>
  );
}
