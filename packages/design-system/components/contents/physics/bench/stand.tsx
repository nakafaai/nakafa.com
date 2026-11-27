import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";

/**
 * A retort stand: a heavy enamelled base on the bench at the origin, a steel
 * rod `tall` high at its back, and a boss with an arm `reach` long at
 * `height` that ends in a cork-lined clamp. The arm points toward -x, so the
 * clamp holds whatever stands `reach` to the left of the rod.
 */
export function Stand({
  height,
  reach,
  tall,
}: {
  readonly height: number;
  readonly reach: number;
  readonly tall: number;
}) {
  return (
    <group>
      <mesh castShadow position={[-0.12, 0.025, 0]} receiveShadow>
        <boxGeometry args={[0.62, 0.05, 0.42]} />
        <meshPhysicalMaterial
          clearcoat={0.5}
          color={APPARATUS_COLORS.caseDark}
          roughness={0.45}
        />
      </mesh>
      <mesh castShadow position={[0, tall / 2, 0]}>
        <cylinderGeometry args={[0.022, 0.022, tall, 16]} />
        <MetalMaterial color={APPARATUS_COLORS.nickel} roughness={0.24} />
      </mesh>
      <mesh castShadow position={[0, height, 0]}>
        <boxGeometry args={[0.09, 0.09, 0.09]} />
        <MetalMaterial color={APPARATUS_COLORS.caseSteel} roughness={0.4} />
      </mesh>
      <mesh
        castShadow
        position={[-reach / 2, height, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.016, 0.016, reach, 12]} />
        <MetalMaterial color={APPARATUS_COLORS.nickel} roughness={0.28} />
      </mesh>
      <mesh
        castShadow
        position={[-reach - 0.05, height, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[0.05, 0.016, 10, 28]} />
        <meshStandardMaterial
          color={APPARATUS_COLORS.beechEnd}
          roughness={0.85}
        />
      </mesh>
    </group>
  );
}
