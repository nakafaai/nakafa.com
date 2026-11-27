import { useFrame } from "@react-three/fiber";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { scatterMotes } from "@repo/design-system/components/three/stage/scatter";
import { useEffect, useMemo } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  NormalBlending,
  ShaderMaterial,
} from "three";

/**
 * Places each mote, wanders it and sizes it on screen. A mote near the lab
 * wanders on a path of sines that never repeats in step with its
 * neighbours, as a grain does in Brownian motion, and blurs wider and
 * fainter the farther it floats from the plane the camera is focused on. A
 * distant mote, a star, keeps its direction whatever the camera's place and
 * only twinkles.
 */
const VERTEX = `
attribute vec4 trait;
uniform float uTime;
uniform float uPixel;
uniform float uSize;
uniform float uDrift;
uniform float uPace;
uniform float uSpread;
uniform float uBlur;
varying float vTint;
varying float vFade;
void main() {
  float t = uTime * uPace * (0.5 + trait.z) + trait.y * 6.2831853;
  vTint = trait.w;
#ifdef DISTANT
  vec4 seen = vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = projectionMatrix * seen;
  gl_Position.z = gl_Position.w;
  gl_PointSize = uPixel * uSize * (0.4 + 1.8 * trait.x);
  vFade = (0.3 + 0.7 * sqrt(trait.x)) * (0.82 + 0.18 * sin(t * 2.0));
#else
  vec3 wander = vec3(
    sin(t * 1.3) + 0.5 * sin(t * 2.9 + 1.7),
    sin(t * 1.1 + 2.1) + 0.5 * sin(t * 3.1 + 0.3),
    sin(t * 0.9 + 4.2) + 0.5 * sin(t * 2.3 + 5.1)
  );
  vec4 seen = modelViewMatrix * vec4(position * uSpread + uDrift * wander, 1.0);
  float depth = max(0.0001, -seen.z);
  float focus = max(0.0001, -(viewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).z);
  float blur = 1.0 + uBlur * abs(depth - focus) / focus;
  gl_Position = projectionMatrix * seen;
  gl_PointSize = min(128.0, uPixel * uSize * (0.3 + trait.x) * blur / depth);
  vFade = smoothstep(0.0, 0.3 * focus, depth) / blur;
#endif
}
`;

/** Draws each mote as a soft round grain between the scatter's two tints. */
const FRAGMENT = `
uniform vec3 uFrom;
uniform vec3 uTo;
uniform float uOpacity;
varying float vTint;
varying float vFade;
void main() {
  float far = length(gl_PointCoord - 0.5) * 2.0;
  float body = smoothstep(1.0, 0.2, far);
  gl_FragColor = vec4(mix(uFrom, uTo, vTint), body * uOpacity * vFade);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * Small matter adrift in a place: solutes and granules in water, dust in
 * the air of a dark room, or the stars of open space. The stage's tier sets
 * how many there are, they are scattered once, and the graphics card alone
 * moves them, so a frame costs one draw and allocates nothing. The camera
 * leaves them out when it frames the lab.
 *
 * @param blur - How much a mote widens away from the plane in focus
 * @param distant - Whether the motes stand at infinity, as stars do
 * @param drift - How far a mote wanders from its place, in reaches
 * @param from - The tint at one end of the scatter
 * @param hollow - The share of the spread around the lab's middle kept empty
 * @param lit - Whether a mote adds its light to what lies behind it
 * @param opacity - How much of a mote shows at its clearest
 * @param pace - How fast the motes wander
 * @param seed - Which scatter the motes take
 * @param share - The share of the tier's motes that are drawn
 * @param size - The widest mote: in reaches near the lab, in pixels at infinity
 * @param spread - How far the motes spread from the lab's middle, in reaches
 * @param to - The tint at the other end of the scatter
 */
export function Motes({
  blur = 0,
  distant = false,
  drift = 0,
  from,
  hollow = 0,
  lit = false,
  opacity,
  pace = 1,
  seed,
  share = 1,
  size,
  spread = 1,
  to,
}: {
  readonly blur?: number;
  readonly distant?: boolean;
  readonly drift?: number;
  readonly from: string;
  readonly hollow?: number;
  readonly lit?: boolean;
  readonly opacity: number;
  readonly pace?: number;
  readonly seed: number;
  readonly share?: number;
  readonly size: number;
  readonly spread?: number;
  readonly to: string;
}) {
  const { profile, reach } = useStage();
  const count = Math.round(profile.motes * share);
  const geometry = useMemo(() => {
    const { places, traits } = scatterMotes(count, seed, hollow);
    const scatter = new BufferGeometry();
    scatter.setAttribute("position", new BufferAttribute(places, 3));
    scatter.setAttribute("trait", new BufferAttribute(traits, 4));
    return scatter;
  }, [count, hollow, seed]);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        blending: lit ? AdditiveBlending : NormalBlending,
        defines: distant ? { DISTANT: "" } : {},
        depthWrite: false,
        fragmentShader: FRAGMENT,
        transparent: true,
        uniforms: {
          uBlur: { value: blur },
          uDrift: { value: drift * reach },
          uFrom: { value: new Color(from) },
          uOpacity: { value: opacity },
          uPace: { value: pace },
          uPixel: { value: 1 },
          uSize: { value: distant ? size : size * reach },
          uSpread: { value: spread * reach },
          uTime: { value: 0 },
          uTo: { value: new Color(to) },
        },
        vertexShader: VERTEX,
      }),
    [blur, distant, drift, from, lit, opacity, pace, reach, size, spread, to]
  );

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ camera, size: canvas, viewport }, delta) => {
    const { uPixel, uTime } = material.uniforms;
    if (uPixel === undefined || uTime === undefined) {
      return;
    }
    uTime.value += delta;
    // One scene unit at depth 1 covers this many pixels of the canvas.
    uPixel.value = distant
      ? viewport.dpr
      : 0.5 *
        canvas.height *
        viewport.dpr *
        (camera.projectionMatrix.elements[5] ?? 1);
  });

  return (
    <CameraBounds exclude>
      <points
        frustumCulled={false}
        geometry={geometry}
        material={material}
        renderOrder={distant ? -900 : 0}
      />
    </CameraBounds>
  );
}
