import { ReadingCamera } from "@repo/design-system/components/three/instrument/camera";
import { Micrometer } from "@repo/design-system/components/three/instrument/micrometer";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";

/**
 * A micrometer screw gauge closed on a bearing ball `thickness` millimetres
 * across, lying on the bench, seen from over its sleeve and thimble so both
 * scales can be read.
 *
 * @param thickness - The ball's diameter, in millimetres
 */
export function GaugeScene({ thickness }: { readonly thickness: number }) {
  return (
    <group>
      <ReadingCamera
        narrow={[0.5, 0.86, 0.2]}
        target={[0.5, 0.09, -0.02]}
        wide={[0.42, 0.78, 0.2]}
      />
      <Micrometer reading={thickness}>
        <mesh castShadow position={[thickness / 2, 0, 0]} receiveShadow>
          <sphereGeometry args={[thickness / 2, 64, 48]} />
          <SurfaceMaterial
            color={CAR_COLORS.chrome}
            metalness={1}
            repeat={[2, 2]}
            roughness={0.12}
            surface="brushed"
          />
        </mesh>
      </Micrometer>
    </group>
  );
}
