import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { GROUNDS } from "@repo/design-system/components/three/stage/land";
import { useEffect, useMemo } from "react";
import type { ColorRepresentation } from "three";
import { BackSide, Color, ShaderMaterial } from "three";

/** How far above the horizon the haze still veils the backdrop, as the sine of that height. */
const VEIL = 0.07;

/** Keeps the distance at the far end of every view, turning with the camera alone. */
const VERTEX = `
varying vec3 vWay;
void main() {
  vWay = position;
  gl_Position = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position.z = gl_Position.w;
}
`;

/**
 * Fills everything below the horizon with the haze, and veils the backdrop
 * just above the horizon with it, thinning upward. It is written in the
 * colour the scene's fog is, untouched by tone mapping as fog is, so ground
 * that has faded into the fog cannot be told from it.
 */
const FRAGMENT = `
uniform vec3 uHaze;
varying vec3 vWay;
void main() {
  float height = normalize(vWay).y;
  gl_FragColor = vec4(uHaze, 1.0 - smoothstep(0.0, ${VEIL}, height));
  #include <colorspace_fragment>
}
`;

/**
 * The far distance of open ground: the haze that the ground runs into at
 * the horizon. The stage's ground reaches only as far as the fog has
 * swallowed it; from there to the horizon, in every direction and from any
 * camera, lies this haze, in the fog's own colour, so the ground has no end
 * to see and no band of blurred backdrop lies between it and the sky. A lab
 * on a bench, or with no floor, has no horizon and draws nothing here.
 *
 * @param color - The colour of the haze, which is the colour of the fog
 */
export function Distance({ color }: { readonly color: ColorRepresentation }) {
  const { floor, ground } = useStage();
  const open =
    floor !== undefined && ground !== undefined && !GROUNDS[ground].indoor;
  const material = useMemo(
    () =>
      new ShaderMaterial({
        depthWrite: false,
        fragmentShader: FRAGMENT,
        side: BackSide,
        toneMapped: false,
        transparent: true,
        uniforms: { uHaze: { value: new Color(color) } },
        vertexShader: VERTEX,
      }),
    [color]
  );

  useEffect(() => () => material.dispose(), [material]);

  if (!open) {
    return null;
  }

  return (
    <CameraBounds exclude>
      <mesh frustumCulled={false} material={material} renderOrder={-950}>
        <icosahedronGeometry args={[1, 3]} />
      </mesh>
    </CameraBounds>
  );
}
