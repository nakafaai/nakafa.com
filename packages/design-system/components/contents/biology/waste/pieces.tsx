import {
  fillOf,
  VESSELS,
} from "@repo/design-system/components/contents/biology/waste/pour";
import type { Waste } from "@repo/design-system/components/contents/biology/waste/route";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Match } from "effect";

/** One piece of school laboratory waste drawn in real scale. */
export function WastePiece({
  item,
  liquidLevel,
}: {
  readonly item: Waste;
  readonly liquidLevel?: number | undefined;
}) {
  return Match.value(item).pipe(
    Match.when("culture", () => (
      <group>
        <mesh castShadow position={[0, 0.008, 0]}>
          <cylinderGeometry args={[0.042, 0.042, 0.015, 24]} />
          <meshStandardMaterial
            color={LABORATORY_COLORS.agar}
            roughness={0.4}
          />
        </mesh>
        <mesh position={[0.012, 0.016, 0.006]}>
          <sphereGeometry args={[0.007, 12, 12]} />
          <meshStandardMaterial color={LABORATORY_COLORS.colony} />
        </mesh>
      </group>
    )),
    Match.when("glove", () => (
      <mesh castShadow position={[0, 0.012, 0]}>
        <boxGeometry args={[0.06, 0.02, 0.045]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.nitrile}
          roughness={0.6}
        />
      </mesh>
    )),
    Match.when("swab", () => (
      <group position={[0, 0.008, 0]} rotation={[0, 0.3, Math.PI / 2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.002, 0.002, 0.11, 8]} />
          <meshStandardMaterial color={LABORATORY_COLORS.wood} />
        </mesh>
        <mesh position={[0, 0.055, 0]}>
          <sphereGeometry args={[0.008, 12, 12]} />
          <meshStandardMaterial color={LABORATORY_COLORS.coat} />
        </mesh>
      </group>
    )),
    Match.when("blade", () => (
      <mesh castShadow position={[0, 0.004, 0]}>
        <boxGeometry args={[0.042, 0.003, 0.01]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.chrome}
          metalness={0.85}
          roughness={0.15}
        />
      </mesh>
    )),
    Match.when("slide", () => (
      <group position={[0, 0.003, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.072, 0.003, 0.025]} />
          <meshPhysicalMaterial
            color={LABORATORY_COLORS.polystyrene}
            opacity={0.7}
            roughness={0.15}
            transparent
          />
        </mesh>
        <mesh position={[0, 0.002, 0]}>
          <cylinderGeometry args={[0.007, 0.007, 0.001, 14]} />
          <meshStandardMaterial color={BIOLOGY_COLORS.methyleneBlue} />
        </mesh>
      </group>
    )),
    Match.when("glass", () => (
      <group position={[0, 0.008, 0]}>
        <mesh castShadow position={[-0.01, 0, 0]} rotation={[0.2, 0.5, 0.3]}>
          <coneGeometry args={[0.016, 0.024, 3]} />
          <meshPhysicalMaterial
            color={LABORATORY_COLORS.polystyrene}
            opacity={0.75}
            roughness={0.1}
            transparent
          />
        </mesh>
        <mesh
          castShadow
          position={[0.012, 0, 0.006]}
          rotation={[-0.3, -0.4, 0.2]}
        >
          <coneGeometry args={[0.013, 0.02, 3]} />
          <meshPhysicalMaterial
            color={LABORATORY_COLORS.polystyrene}
            opacity={0.75}
            roughness={0.1}
            transparent
          />
        </mesh>
      </group>
    )),
    Match.when("salt", () => {
      const vessel = VESSELS.salt;
      const depth = liquidLevel ?? fillOf(vessel);
      return (
        <group>
          <mesh castShadow position={[0, vessel.height / 2, 0]}>
            <cylinderGeometry
              args={[vessel.radius, vessel.radius, vessel.height, 20]}
            />
            <meshPhysicalMaterial
              color={LABORATORY_COLORS.polystyrene}
              opacity={0.45}
              roughness={0.1}
              transparent
            />
          </mesh>
          <mesh position={[0, depth / 2, 0]}>
            <cylinderGeometry
              args={[vessel.radius * 0.9, vessel.radius * 0.9, depth, 18]}
            />
            <meshStandardMaterial
              color={LABORATORY_COLORS.water}
              opacity={0.8}
              transparent
            />
          </mesh>
        </group>
      );
    }),
    Match.when("solvent", () => {
      const vessel = VESSELS.solvent;
      const depth = liquidLevel ?? fillOf(vessel);
      return (
        <group>
          <mesh castShadow position={[0, vessel.height / 2, 0]}>
            <cylinderGeometry
              args={[vessel.radius, vessel.radius, vessel.height, 20]}
            />
            <meshPhysicalMaterial
              color={LABORATORY_COLORS.polystyrene}
              opacity={0.45}
              roughness={0.1}
              transparent
            />
          </mesh>
          <mesh position={[0, depth / 2, 0]}>
            <cylinderGeometry
              args={[vessel.radius * 0.9, vessel.radius * 0.9, depth, 18]}
            />
            <meshStandardMaterial
              color={PLOT_COLORS.amber}
              opacity={0.8}
              transparent
            />
          </mesh>
        </group>
      );
    }),
    Match.exhaustive
  );
}
