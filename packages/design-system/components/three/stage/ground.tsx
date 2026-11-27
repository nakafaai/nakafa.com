import { ContactShadows } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { GROUNDS } from "@repo/design-system/components/three/stage/land";
import { Lawn } from "@repo/design-system/components/three/stage/lawn";
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

/**
 * The unseen floor that shows only the key light's shadows. A lab whose
 * place has no ground, such as open space, has it alone, over the backdrop.
 * A top inside a room has it over its own surface, where the room's soft
 * light alone would leave that shadow too pale to read.
 */
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
 * The floor a lab stands on, when it names one. It gets the ground it
 * names, or the ground of its place: open land as far as the haze, or a
 * bench or table top that dissolves into the room, under the shadow catcher.
 * Grass is a lawn: blades stand on it wherever the camera looks.
 * A lab whose place has no ground, or that is a block cut out of the
 * ground, gets the shadow catcher alone.
 *
 * Static desktop and capable mobile labs bake soft contact shadows once
 * (`frames={1}`) so they add zero per-frame render passes after frame one.
 * Low-end, software-rendered, and animated labs rely on the directional key
 * light's real-time shadow map alone, avoiding 3 full-scene shadow and blur
 * passes per frame.
 */
export function Ground() {
  const { animated, floor, ground, reach, tier } = useStage();

  if (floor === undefined) {
    return null;
  }

  const bakeContactShadows = (tier === "full" || tier === "light") && !animated;
  const catches = ground === undefined || GROUNDS[ground].indoor;

  return (
    <>
      {ground === "grass" ? (
        <Lawn>
          <Terrain kind={ground} />
        </Lawn>
      ) : null}
      {ground === undefined || ground === "grass" ? null : (
        <Terrain kind={ground} />
      )}
      {catches ? <Catcher /> : null}
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
