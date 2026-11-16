import { ContactShadows } from "@react-three/drei";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { useStage } from "@repo/design-system/components/three/stage/context";

/** How far the shadow-catching ground spreads, in reaches of the lab. */
const GROUND_SPAN = 20;

/** How dark the key light's shadow falls on the ground, over the backdrop. */
const SHADOW_OPACITY = 0.3;

/**
 * The floor a lab stands on, when it names one. The ground itself stays
 * unseen and shows only the key light's shadows, as a photographer sets a
 * subject onto a background plate, and soft contact shadows darken it where
 * things touch it. The occlusion treats it as opaque, so it grounds what
 * stands on it instead of drawing the whole ground a second time, and the
 * camera leaves it out when it frames the lab.
 */
export function Ground() {
  const { floor, reach } = useStage();

  if (floor === undefined) {
    return null;
  }

  return (
    <>
      <CameraBounds exclude>
        <mesh
          position={[0, floor + 0.001, 0]}
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
          userData={{ treatAsOpaque: true }}
        >
          <planeGeometry args={[GROUND_SPAN * reach, GROUND_SPAN * reach]} />
          <shadowMaterial opacity={SHADOW_OPACITY} />
        </mesh>
      </CameraBounds>
      <ContactShadows
        blur={2.4}
        far={reach / 2}
        opacity={0.38}
        position={[0, floor + 0.002, 0]}
        resolution={512}
        scale={2 * reach}
      />
    </>
  );
}
