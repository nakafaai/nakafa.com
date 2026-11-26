import {
  useGround,
  useHorizonFade,
} from "@repo/design-system/components/three/stage/terrain";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";

/**
 * A seamless dark-epoxy laboratory benchtop that catches soft vessel shadows
 * near the experiment and dissolves smoothly into the blurred teaching-lab
 * backdrop with a C2 quintic radial fade so no sharp slab edge cuts across
 * the frame from any camera angle.
 */
export function SeamlessBenchSurface({
  radius = 18,
  y = 0,
}: {
  readonly radius?: number;
  readonly y?: number;
}) {
  const texture = useGround("concrete", [radius * 1.4, radius * 1.4]);
  const horizonFade = useHorizonFade(radius * 0.16, radius * 0.72);

  return (
    <mesh
      position={[0, y, 0]}
      receiveShadow
      renderOrder={-10}
      rotation={[-Math.PI / 2, 0, 0]}
      userData={{ treatAsOpaque: true }}
    >
      <circleGeometry args={[radius, 96]} />
      <meshPhysicalMaterial
        aoMap={texture.patches}
        aoMapIntensity={0.4}
        bumpMap={texture.bump}
        bumpScale={0.015}
        clearcoat={0.55}
        clearcoatRoughness={0.28}
        color={BENCH_COLORS.epoxy}
        depthWrite
        ref={horizonFade}
        roughness={0.54}
        transparent
      />
    </mesh>
  );
}
