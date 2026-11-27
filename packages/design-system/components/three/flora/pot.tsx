import { Soil } from "@repo/design-system/components/three/flora/soil";
import { Turn } from "@repo/design-system/components/three/form/part";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { FLORA_COLORS } from "@repo/design-system/lib/material/flora";
import { DoubleSide } from "three";

/** The wall of a clay flowerpot: a foot ring, a tapered side, a thick rolled rim and the inside down to the soil. */
const POT_PROFILE = [
  [0, 0.012],
  [0.05, 0.012],
  [0.052, 0.004],
  [0.2, 0],
  [0.238, 0.004],
  [0.248, 0.018],
  [0.262, 0.07],
  [0.29, 0.17],
  [0.316, 0.268],
  [0.322, 0.279],
  [0.352, 0.283],
  [0.362, 0.292],
  [0.366, 0.31],
  [0.366, 0.342],
  [0.36, 0.354],
  [0.345, 0.358],
  [0.33, 0.354],
  [0.324, 0.342],
  [0.318, 0.3],
  [0.3, 0.2],
] as const;

/** How high the soil in the pot lies above its foot, for a plant set into it. */
const POT_SOIL = 0.292;

/**
 * A clay flowerpot filled with moist soil, standing on its foot at the
 * origin: thrown terracotta with a rolled rim, the pitted, unglazed surface
 * of fired clay, and a heaped bed of crumbly soil inside it.
 */
export function Pot() {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <Turn profile={POT_PROFILE} />
        <SurfaceMaterial
          bump={0.9}
          color={FLORA_COLORS.potClay}
          repeat={[7, 2]}
          roughness={0.92}
          side={DoubleSide}
          surface="concrete"
        />
      </mesh>
      <group position={[0, POT_SOIL, 0]}>
        <Soil count={700} heap={0.035} radius={0.318} seed={7} />
      </group>
    </group>
  );
}
