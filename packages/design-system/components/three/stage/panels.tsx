import { Environment, Lightformer } from "@react-three/drei";

/**
 * The light of a photo studio, built from glowing panels around an empty
 * scene and baked once into the environment map. Nothing is downloaded, so it
 * lights a lab at once while the setting's own file loads: a wide box
 * overhead, two long strips that draw highlights along glass and metal, a
 * front panel that opens the shadows, and a dim floor bounce.
 */
export function Panels() {
  return (
    <Environment environmentIntensity={0.85} frames={1} resolution={256}>
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
