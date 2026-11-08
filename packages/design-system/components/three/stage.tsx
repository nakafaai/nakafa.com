import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";
import { AgXToneMapping } from "three";

/** How far a lab reaches from its middle when it names no reach, in scene units. */
const DEFAULT_REACH = 5;

/**
 * The light of a photo studio, built from glowing panels around an empty
 * scene and baked once into the environment map every surface reflects. A
 * wide box overhead lights the lab, two long strips draw clean highlights
 * along glass and metal, a front panel opens the shadows, and a dim floor
 * bounce keeps undersides from turning black. Nothing is downloaded: no HDR
 * file and no CDN preset.
 */
function StudioEnvironment() {
  return (
    <Environment environmentIntensity={0.85} frames={1} resolution={256}>
      <color args={[getColor("NEUTRAL", 700)]} attach="background" />
      <Lightformer
        form="rect"
        intensity={2.2}
        position={[0, 7, 0]}
        rotation-x={Math.PI / 2}
        scale={[14, 14, 1]}
      />
      <Lightformer
        form="rect"
        intensity={1.4}
        position={[-7, 2.5, 0]}
        rotation-y={Math.PI / 2}
        scale={[18, 1.4, 1]}
      />
      <Lightformer
        form="rect"
        intensity={1.4}
        position={[7, 2.5, 0]}
        rotation-y={-Math.PI / 2}
        scale={[18, 1.4, 1]}
      />
      <Lightformer
        form="rect"
        intensity={0.9}
        position={[0, 2.5, 9]}
        scale={[12, 5, 1]}
      />
      <Lightformer
        form="rect"
        intensity={0.3}
        position={[0, -5, 0]}
        rotation-x={-Math.PI / 2}
        scale={[24, 24, 1]}
      />
    </Environment>
  );
}

/**
 * The stage every science lab stands on: a canvas that tone maps with AgX, so
 * bright glass, liquid, and metal roll off softly instead of clipping, lit by
 * the studio environment and one key light that casts the lab's shadows. A
 * lab with a floor names its height, and soft contact shadows then ground
 * whatever stands on it.
 *
 * @param reach - How far the lab reaches from its middle, which the key
 * light's shadows and the contact shadows cover
 * @param floor - The height of the floor objects stand on, when there is one
 */
export function ScienceStage({
  children,
  floor,
  frameloop = "demand",
  reach = DEFAULT_REACH,
}: {
  readonly children: ReactNode;
  readonly floor?: number;
  readonly frameloop?: "always" | "demand";
  readonly reach?: number;
}) {
  return (
    <ThreeCanvas frameloop={frameloop} toneMapping={AgXToneMapping}>
      <StudioEnvironment />
      <directionalLight
        castShadow
        intensity={1.6}
        position={[0.7 * reach, 1.2 * reach, 0.9 * reach]}
        shadow-bias={-0.0006}
        shadow-camera-bottom={-reach}
        shadow-camera-left={-reach}
        shadow-camera-right={reach}
        shadow-camera-top={reach}
        shadow-mapSize-height={1024}
        shadow-mapSize-width={1024}
        shadow-normalBias={0.02}
      />
      {floor === undefined ? null : (
        <ContactShadows
          blur={2.4}
          far={reach / 2}
          opacity={0.38}
          position={[0, floor + 0.002, 0]}
          resolution={512}
          scale={2 * reach}
        />
      )}
      {children}
    </ThreeCanvas>
  );
}
