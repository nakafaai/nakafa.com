import {
  CAPILLARY,
  ClearGlass,
  useLathe,
} from "@repo/design-system/components/contents/biology/respirometer/glass";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { RESPIROMETER_COLORS } from "@repo/design-system/lib/material/respirometer";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";

/** The reset tube's rubber sleeve, in metres: its outer and inner radii, its length, and where the screw clip pinches it. */
const SLEEVE = {
  inner: 0.003_05,
  length: 0.034,
  outer: 0.0045,
  pinch: 0.02,
} as const;

/** The rubber sleeve's wall turned from its foot, squeezed flat across z where the clip closes on it. */
function useSleeve() {
  const lathe = useLathe(
    [
      [SLEEVE.inner, 0],
      [SLEEVE.outer, 0],
      ...Arr.map(
        Arr.range(1, 23),
        (step) => [SLEEVE.outer, (SLEEVE.length * step) / 24] as const
      ),
      [SLEEVE.outer, SLEEVE.length],
      [SLEEVE.inner, SLEEVE.length],
      ...Arr.map(
        Arr.range(1, 23),
        (step) =>
          [SLEEVE.inner, SLEEVE.length - (SLEEVE.length * step) / 24] as const
      ),
    ],
    24
  );
  const geometry = useMemo(() => {
    const squeezed = lathe.clone();
    const position = squeezed.getAttribute("position");
    Arr.forEach(Arr.range(0, position.count - 1), (index) => {
      const near = Math.max(
        0,
        1 - Math.abs(position.getY(index) - SLEEVE.pinch) / 0.007
      );
      const pinch = near * near * (3 - 2 * near);
      position.setX(index, position.getX(index) * (1 + 0.36 * pinch));
      position.setZ(index, position.getZ(index) * (1 - 0.64 * pinch));
    });
    squeezed.computeVertexNormals();
    return squeezed;
  }, [lathe]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/**
 * The screw clip's steel strip, in metres: how tall and thick it is, and
 * half the frame's 20 mm inner width (Philip Harris Hoffman clip, 20 mm).
 */
const CLIP = { height: 0.0045, inner: 0.01, strip: 0.0011 } as const;

/**
 * The reset valve on top of the bung: a short glass tube through it, a
 * rubber sleeve over its end, and a Hoffman screw clip screwed shut across
 * the sleeve, so no air passes once the drop is set.
 */
export function ResetValve() {
  const sleeve = useSleeve();
  const pinched = SLEEVE.outer * 0.36;
  const back = -pinched - CLIP.strip / 2;
  const plate = pinched + 0.0006;
  const front = plate + 0.0046;
  return (
    <group>
      <mesh position={[0, -0.006, 0]}>
        <cylinderGeometry
          args={[CAPILLARY.radius, CAPILLARY.radius, 0.036, 16, 1, true]}
        />
        <ClearGlass opacity={0.34} />
      </mesh>
      <mesh castShadow geometry={sleeve} position={[0, 0.002, 0]}>
        <meshPhysicalMaterial
          clearcoat={0.2}
          clearcoatRoughness={0.5}
          color={RESPIROMETER_COLORS.rubber}
          roughness={0.7}
        />
      </mesh>
      <group position={[0, 0.002 + SLEEVE.pinch, 0]}>
        <ClipPart
          position={[0, 0, back]}
          size={[CLIP.inner * 2 + CLIP.strip * 2, CLIP.height, CLIP.strip]}
        />
        <ClipPart
          position={[0, 0, front]}
          size={[CLIP.inner * 2 + CLIP.strip * 2, CLIP.height, CLIP.strip]}
        />
        {Arr.map([-1, 1] as const, (side) => (
          <ClipPart
            key={side}
            position={[
              side * (CLIP.inner + CLIP.strip / 2),
              0,
              (back + front) / 2,
            ]}
            size={[CLIP.strip, CLIP.height, front - back + CLIP.strip]}
          />
        ))}
        <ClipPart
          position={[0, 0, plate + 0.0006]}
          size={[CLIP.inner * 1.8, CLIP.height * 0.85, 0.0012]}
        />
        <mesh position={[0, 0, front + 0.002]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry
            args={[0.0011, 0.0011, front - plate + 0.004, 10]}
          />
          <MetalMaterial color={RESPIROMETER_COLORS.zinc} roughness={0.35} />
        </mesh>
        <mesh
          castShadow
          position={[0, 0, front + 0.0062]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.0034, 0.0034, 0.0036, 18]} />
          <MetalMaterial color={RESPIROMETER_COLORS.zinc} roughness={0.42} />
        </mesh>
      </group>
    </group>
  );
}

/** One flat steel piece of the screw clip, `size` in metres. */
function ClipPart({
  position,
  size,
}: {
  readonly position: readonly [number, number, number];
  readonly size: readonly [number, number, number];
}) {
  return (
    <mesh castShadow position={position}>
      <boxGeometry args={size} />
      <MetalMaterial color={RESPIROMETER_COLORS.zinc} roughness={0.35} />
    </mesh>
  );
}
