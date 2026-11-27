import { useThree } from "@react-three/fiber";
import { starField } from "@repo/design-system/components/three/habitat/stars";
import { ECOLOGY_COLORS } from "@repo/design-system/lib/material/ecology";
import { useEffect, useMemo } from "react";
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  ShaderMaterial,
} from "three";

/** How many stars the sky holds: enough for a dense band, few enough for a phone. */
const COUNT = 5200;

/** Each star is drawn as one point, as large as its brightness and the screen's density ask. */
const STAR_VERTEX = /* glsl */ `
attribute float size;
attribute vec3 tint;
uniform float scale;
varying vec3 vTint;

void main() {
  vTint = tint;
  gl_PointSize = size * scale;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** Each star is a soft round point of light with a bright core, never a square. */
const STAR_FRAGMENT = /* glsl */ `
varying vec3 vTint;

void main() {
  float away = length(gl_PointCoord - 0.5) * 2.0;
  float glow = pow(max(1.0 - away, 0.0), 2.2);
  gl_FragColor = vec4(vTint * glow, 1.0);
  #include <colorspace_fragment>
}
`;

/**
 * The stars of open space around a scene: thousands of points of several
 * tints, mostly faint, crowded toward the band of the galaxy. They do not
 * twinkle, because nothing stands between them and the camera, so they cost
 * nothing per frame. With `backdrop` the black of space stands behind them,
 * for a scene whose stage is not already open space.
 *
 * @param radius - How far from the scene's middle the stars stand
 * @param sky - Which sky it is
 * @param backdrop - Whether the black of space is drawn behind the stars
 */
export function Stars({
  backdrop = false,
  radius,
  sky = 3,
}: {
  readonly backdrop?: boolean;
  readonly radius: number;
  readonly sky?: number;
}) {
  const pixels = useThree((state) => state.viewport.dpr);
  const parts = useMemo(() => {
    const field = starField(COUNT, sky);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(field.places, 3));
    geometry.setAttribute("tint", new BufferAttribute(field.tints, 3));
    geometry.setAttribute("size", new BufferAttribute(field.sizes, 1));
    const material = new ShaderMaterial({
      blending: AdditiveBlending,
      depthWrite: false,
      fragmentShader: STAR_FRAGMENT,
      transparent: true,
      uniforms: { scale: { value: 1 } },
      vertexShader: STAR_VERTEX,
    });
    return { geometry, material };
  }, [sky]);
  useEffect(
    () => () => {
      parts.geometry.dispose();
      parts.material.dispose();
    },
    [parts]
  );
  useEffect(() => {
    parts.material.uniforms.scale = { value: pixels };
  }, [parts, pixels]);

  return (
    <group scale={radius}>
      {backdrop ? (
        <mesh scale={1.04}>
          <sphereGeometry args={[1, 32, 16]} />
          <meshBasicMaterial
            color={ECOLOGY_COLORS.spaceVoid}
            depthWrite={false}
            fog={false}
            side={BackSide}
            toneMapped={false}
          />
        </mesh>
      ) : null}
      <points
        frustumCulled={false}
        geometry={parts.geometry}
        material={parts.material}
      />
    </group>
  );
}
