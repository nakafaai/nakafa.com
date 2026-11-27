import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";

/**
 * A bearing ball: a ground and polished chrome steel sphere, the object a
 * micrometer or a caliper is closed on because its diameter is the same
 * whichever way it is held.
 *
 * It is drawn about the origin, in the units of the instrument that holds
 * it.
 *
 * @param diameter - How far across the ball is
 */
export function Bearing({ diameter }: { readonly diameter: number }) {
  return (
    <mesh castShadow receiveShadow>
      <sphereGeometry args={[diameter / 2, 64, 48]} />
      <SurfaceMaterial
        color={CAR_COLORS.chrome}
        metalness={1}
        repeat={[2, 2]}
        roughness={0.12}
        surface="brushed"
      />
    </mesh>
  );
}
