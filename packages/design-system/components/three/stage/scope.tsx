import { useFrame } from "@react-three/fiber";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { useEffect, useMemo } from "react";
import { Color, ShaderMaterial } from "three";

/**
 * The radius of the lit field, as a share of the frame's half diagonal: the
 * field stop cuts the frame's corners, as an eyepiece does, and leaves the
 * specimen its whole width.
 */
const FIELD = 0.84;

/** Covers the whole frame, behind everything or in front of it. */
const VERTEX = `
varying vec2 vPlace;
void main() {
  vPlace = position.xy;
  gl_Position = vec4(position.xy, DEPTH, 1.0);
}
`;

/** Where a pixel lies in the field: 0 at its middle, 1 at the field stop. */
const PLACE = `
uniform float uAspect;
varying vec2 vPlace;
float fromMiddle(out vec2 place) {
  place = vPlace * vec2(uAspect, 1.0);
  return length(place) / (${FIELD} * length(vec2(uAspect, 1.0)));
}
`;

/**
 * The light that comes up through the slide: brightest in the middle of the
 * field and a little warmer and dimmer toward its rim, uneven as a real
 * lamp and condenser leave it, with the faint smears and specks of the
 * glass drifting far out of focus.
 */
const LIGHT = `
${PLACE}
uniform vec3 uCore;
uniform vec3 uRim;
uniform float uDim;
uniform float uTime;
float chance(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(chance(i), chance(i + vec2(1, 0)), f.x),
             mix(chance(i + vec2(0, 1)), chance(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 place;
  float far = fromMiddle(place);
  vec3 lit = mix(uCore, uRim, smoothstep(0.0, 1.0, far * far));
  float uneven = 0.6 * noise(place * 1.3 + uTime * 0.01) + 0.4 * noise(place * 3.1 - uTime * 0.014);
  lit *= 0.93 + 0.12 * uneven;
  float smear = smoothstep(0.6, 0.82, noise(place * 4.2 + vec2(uTime * 0.012, 9.0)));
  float speck = smoothstep(0.78, 0.9, noise(place * 11.0 + vec2(3.0, uTime * 0.02)));
  lit *= 1.0 - 0.06 * smear - 0.05 * speck;
  gl_FragColor = vec4(lit * uDim, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * The field stop: black outside the round field, shading the field toward
 * its rim, with the thin warm fringe a lens leaves at the edge of the light.
 */
const STOP = `
${PLACE}
void main() {
  vec2 place;
  float far = fromMiddle(place);
  float outside = smoothstep(0.985, 1.0, far);
  float shade = 0.42 * smoothstep(0.5, 1.0, far);
  float fringe = smoothstep(0.955, 0.985, far) * (1.0 - outside);
  gl_FragColor = vec4(vec3(0.5, 0.26, 0.06) * fringe * 0.5, max(outside, shade));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * The view down a light microscope: the round field lit from below, behind
 * the specimen, and the black field stop around it, in front. Both cover the
 * frame whatever its shape and wherever the camera stands, so the specimen
 * turns inside the field as it would under the lens. The camera leaves both
 * out when it frames the lab.
 *
 * @param core - The tone of the light in the middle of the field
 * @param dim - How much of the field's light shows, which a dark page lowers
 * @param rim - The tone of the light at the field's rim
 */
export function Field({
  core,
  dim,
  rim,
}: {
  readonly core: number;
  readonly dim: number;
  readonly rim: number;
}) {
  const light = useMemo(
    () =>
      new ShaderMaterial({
        defines: { DEPTH: "1.0" },
        depthWrite: false,
        fragmentShader: LIGHT,
        uniforms: {
          uAspect: { value: 1 },
          uCore: { value: new Color(core) },
          uDim: { value: dim },
          uRim: { value: new Color(rim) },
          uTime: { value: 0 },
        },
        vertexShader: VERTEX,
      }),
    [core, dim, rim]
  );
  const stop = useMemo(
    () =>
      new ShaderMaterial({
        defines: { DEPTH: "0.0" },
        depthTest: false,
        depthWrite: false,
        fragmentShader: STOP,
        transparent: true,
        uniforms: { uAspect: { value: 1 } },
        vertexShader: VERTEX,
      }),
    []
  );

  useEffect(() => () => light.dispose(), [light]);
  useEffect(() => () => stop.dispose(), [stop]);

  useFrame(({ size }, delta) => {
    const aspect = size.width / size.height;
    const { uAspect, uTime } = light.uniforms;
    if (uAspect !== undefined && uTime !== undefined) {
      uAspect.value = aspect;
      uTime.value += delta;
    }
    if (stop.uniforms.uAspect !== undefined) {
      stop.uniforms.uAspect.value = aspect;
    }
  });

  return (
    <CameraBounds exclude>
      <mesh frustumCulled={false} material={light} renderOrder={-1000}>
        <planeGeometry args={[2, 2]} />
      </mesh>
      <mesh frustumCulled={false} material={stop} renderOrder={1000}>
        <planeGeometry args={[2, 2]} />
      </mesh>
    </CameraBounds>
  );
}
