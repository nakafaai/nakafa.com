import { ContactShadows } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { Terrain } from "@repo/design-system/components/three/stage/terrain";

/** How far the shadow-catching ground spreads, in reaches of the lab. */
const GROUND_SPAN = 20;

/** How dark the key light's shadow falls on the ground, over the backdrop. */
const SHADOW_OPACITY = 0.3;

/** Frame callbacks run in rising priority, so -1 runs before contact shadows bake. */
const BEFORE_SHADOWS = -1;

/**
 * Lets the renderer clear before baked contact shadows draw on the first frame
 * when EffectComposer holds `autoClear` off.
 */
function ShadowClear() {
  useFrame(({ gl }) => {
    gl.autoClear = true;
  }, BEFORE_SHADOWS);

  return null;
}

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
 * that names only the height gets an unseen shadow catcher.
 *
 * Static desktop labs bake soft contact shadows once (`frames={1}`) so they
 * add zero per-frame render passes. Mobile, low-end, software-rendered, and
 * animated labs rely on the directional key light's real-time shadow map alone,
 * avoiding 3 full-scene shadow and blur passes per frame.
 */
export function Ground() {
  const { animated, floor, ground, reach, tier } = useStage();

  if (floor === undefined) {
    return null;
  }

  const bakeContactShadows = tier === "full" && !animated;

  return (
    <>
      {ground === undefined ? <Catcher /> : <Terrain kind={ground} />}
      {bakeContactShadows ? (
        <>
          <ShadowClear />
          <CameraBounds exclude>
            <ContactShadows
              blur={2.4}
              far={reach / 2}
              frames={1}
              opacity={0.38}
              position={[0, floor + 0.012, 0]}
              resolution={256}
              scale={2 * reach}
            />
          </CameraBounds>
        </>
      ) : null}
    </>
  );
}
