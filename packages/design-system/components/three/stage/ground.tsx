import { ContactShadows } from "@react-three/drei";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { Terrain } from "@repo/design-system/components/three/stage/terrain";

/** How far the shadow-catching ground spreads, in reaches of the lab. */
const GROUND_SPAN = 20;

/** How dark the key light's shadow falls on the ground, over the backdrop. */
const SHADOW_OPACITY = 0.3;

/** The unseen floor of a lab that names no ground: it shows only the key light's shadows on the backdrop. */
function Catcher() {
  const { floor = 0, reach } = useStage();

  return (
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
  );
}

/**
 * The floor a lab stands on, when it names one. A lab that names what its
 * ground is made of stands on that ground, drawn as far as the haze. A lab
 * that names only the height, as an apparatus on a studio backdrop does,
 * gets an unseen floor that shows the key light's shadows, as a photographer
 * sets a subject onto a background plate. Either way soft contact shadows
 * darken the floor where things touch it, and the camera leaves the floor out
 * when it frames the lab.
 */
export function Ground() {
  const { floor, ground, reach } = useStage();

  if (floor === undefined) {
    return null;
  }

  return (
    <>
      {ground === undefined ? <Catcher /> : <Terrain kind={ground} />}
      <CameraBounds exclude>
        <ContactShadows
          blur={2.4}
          far={reach / 2}
          opacity={0.38}
          position={[0, floor + 0.012, 0]}
          resolution={512}
          scale={2 * reach}
        />
      </CameraBounds>
    </>
  );
}
