import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { useHorizonFade } from "@repo/design-system/components/three/stage/terrain";
import { BOARDS } from "@repo/design-system/components/three/surface/detail";
import { useSurfaceMaps } from "@repo/design-system/components/three/surface/material";

/** How far the tabletop spreads from the lab's middle, in reaches. */
const SPREAD = 14;

/** Where the tabletop starts and finishes dissolving into the studio sweep, in reaches. */
const FADE = { inner: 2.4, outer: 9 } as const;

/** How long and how wide one tile of planking lies, in metres: boards 11 cm wide. */
const PLANKS = { length: 1.4, width: 0.11 * BOARDS } as const;

/**
 * The tabletop a tabletop lab stands on: planked hardwood under a satin
 * finish, at the stage's floor. It takes the key light's shadows and
 * dissolves into the studio's seamless backdrop far from the lab, so no slab
 * edge or empty void ever shows behind the objects. The camera leaves it out
 * when it frames the lab.
 *
 * @param color - The wood's own colour
 */
export function StudioTable({ color }: { readonly color: string }) {
  const { floor = 0, reach } = useStage();
  const radius = SPREAD * reach;
  const planks = useSurfaceMaps(
    "planks",
    (2 * radius) / PLANKS.length,
    (2 * radius) / PLANKS.width
  );
  const horizonFade = useHorizonFade(FADE.inner * reach, FADE.outer * reach);

  return (
    <CameraBounds exclude>
      <mesh
        position={[0, floor - 0.0004, 0]}
        receiveShadow
        renderOrder={-10}
        rotation={[-Math.PI / 2, 0, 0]}
        userData={{ treatAsOpaque: true }}
      >
        <circleGeometry args={[radius, 96]} />
        <meshPhysicalMaterial
          aoMap={planks.finish}
          clearcoat={0.35}
          clearcoatRoughness={0.35}
          color={color}
          depthWrite
          map={planks.tone}
          normalMap={planks.normal}
          ref={horizonFade}
          roughness={1}
          roughnessMap={planks.finish}
          transparent
        />
      </mesh>
    </CameraBounds>
  );
}
