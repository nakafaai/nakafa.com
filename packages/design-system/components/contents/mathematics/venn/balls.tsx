import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { VENN_COLORS } from "@repo/design-system/lib/material/venn";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";

/**
 * The balls of the set-sorting lab, each at its real size in metres and
 * resting on y = 0: a felt tennis ball, a moulded plastic ball and a polished
 * steel ball.
 */

/** The seam of a tennis ball: the classic curve over the ball, as a thin white strip. */
function useSeam(radius: number) {
  return useMemo(() => {
    const points = Arr.makeBy(96, (index) => {
      const turn = (index / 96) * Math.PI * 2;
      const point = new Vector3(
        Math.cos(turn) + 0.43 * Math.cos(3 * turn),
        Math.sin(turn) - 0.43 * Math.sin(3 * turn),
        0.92 * Math.sin(2 * turn)
      );
      return point.setLength(radius);
    });
    return new TubeGeometry(
      new CatmullRomCurve3(points, true),
      192,
      0.0013,
      6,
      true
    );
  }, [radius]);
}

/** A felt tennis ball, 6.7 cm across. */
export function TennisBall() {
  const seam = useSeam(0.0336);
  return (
    <group position={[0, 0.0335, 0]}>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[0.0335, 40, 24]} />
        <SurfaceMaterial
          bump={0.5}
          color={VENN_COLORS.felt}
          repeat={[3, 1.5]}
          roughness={0.95}
          surface="cloth"
        />
      </mesh>
      <mesh geometry={seam}>
        <meshStandardMaterial color={VENN_COLORS.seam} roughness={0.7} />
      </mesh>
    </group>
  );
}

/** A plastic play ball, 7 cm across, glossy as a moulded ball is. */
export function PlasticBall({ color }: { readonly color: string }) {
  return (
    <mesh castShadow position={[0, 0.035, 0]} receiveShadow>
      <sphereGeometry args={[0.035, 40, 24]} />
      <meshPhysicalMaterial
        clearcoat={1}
        clearcoatRoughness={0.1}
        color={color}
        roughness={0.3}
      />
    </mesh>
  );
}

/** A polished steel ball, 4 cm across. */
export function SteelBall() {
  return (
    <mesh castShadow position={[0, 0.02, 0]} receiveShadow>
      <sphereGeometry args={[0.02, 40, 24]} />
      <MetalMaterial color={VENN_COLORS.steel} roughness={0.25} />
    </mesh>
  );
}
