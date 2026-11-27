import { useFrame } from "@react-three/fiber";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { useEffect, useMemo } from "react";
import { BackSide, Color, ShaderMaterial, Vector3 } from "three";

/** Keeps the backdrop at the far end of every view, turning with the camera alone. */
const VERTEX = `
varying vec3 vWay;
void main() {
  vWay = position;
  gl_Position = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position.z = gl_Position.w;
}
`;

/**
 * Paints what lies far behind the lab in each direction. The tone rises
 * from the deep below to the light above. Light falls from above in slow
 * shafts and plays in the bright net of lines that ripples cast. Soft dark
 * and pale bodies crowd the distance, out of focus. A pale band of dust and
 * unresolved stars runs across the sky, and the sun stands in it as a disc
 * with its glare. Each place turns on the parts it has; a weak device draws
 * the tone and the bodies alone.
 */
const FRAGMENT = `
uniform vec3 uLow;
uniform vec3 uHigh;
uniform vec3 uGlow;
uniform vec3 uBody;
uniform vec3 uSun;
uniform vec3 uPole;
uniform float uShafts;
uniform float uRipple;
uniform float uCrowd;
uniform float uGrain;
uniform float uBand;
uniform float uDisc;
uniform float uDim;
uniform float uTime;
varying vec3 vWay;
float chance(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(chance(i), chance(i + vec3(1, 0, 0)), f.x),
        mix(chance(i + vec3(0, 1, 0)), chance(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(chance(i + vec3(0, 0, 1)), chance(i + vec3(1, 0, 1)), f.x),
        mix(chance(i + vec3(0, 1, 1)), chance(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
float layered(vec3 p) {
  float sum = 0.0;
  float weight = 0.5;
  for (int layer = 0; layer < 4; layer++) {
    sum += weight * noise(p);
    p = p * 2.03 + vec3(11.7);
    weight *= 0.5;
  }
  return sum;
}
void main() {
  vec3 way = normalize(vWay);
  float up = 0.5 + 0.5 * way.y;
  float slow = noise(way * 1.6 + vec3(0.0, uTime * 0.02, 0.0));
  vec3 tone = mix(uLow, uHigh, smoothstep(0.05, 0.95, up + 0.3 * (slow - 0.5)));
  float near = noise(way * uGrain + vec3(uTime * 0.012, 0.0, 3.0));
  float small = noise(way * uGrain * 2.7 + vec3(7.0, uTime * 0.02, 0.0));
  float bodies = 0.6 * smoothstep(0.52, 0.74, near) + 0.4 * smoothstep(0.56, 0.72, small);
  tone = mix(tone, uBody, uCrowd * bodies);
#ifdef RICH
  float pockets = smoothstep(0.5, 0.8, noise(way * uGrain * 1.3 + vec3(21.0, 4.0, uTime * 0.015)));
  tone += uGlow * 0.5 * uCrowd * pockets * (1.0 - bodies);
  vec2 above = way.xz / (0.4 + abs(way.y));
  float shaft = layered(vec3(above * 2.4, uTime * 0.04));
  tone += uGlow * uShafts * smoothstep(0.42, 0.78, shaft) * smoothstep(-0.3, 0.9, way.y);
  float net = layered(way * 5.0 + vec3(0.0, uTime * 0.05, uTime * 0.03));
  tone += uGlow * uRipple * pow(1.0 - abs(2.0 * net - 1.0), 7.0);
  float along = dot(way, uPole);
  float dust = layered(way * 3.4 + vec3(5.0));
  tone += uGlow * uBand * exp(-18.0 * along * along) * (0.35 + dust) * (1.0 - 0.7 * smoothstep(0.5, 0.7, layered(way * 7.0)));
#endif
  float toward = max(0.0, dot(way, uSun));
  tone += uDisc * (vec3(1.0, 0.96, 0.88) * 40.0 * smoothstep(0.99985, 0.99995, toward) + vec3(1.0, 0.9, 0.75) * (0.5 * pow(toward, 900.0) + 0.08 * pow(toward, 24.0)));
  gl_FragColor = vec4(tone * uDim, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** The axis the band of dust and unresolved stars circles in open space. */
const POLE = new Vector3(0.42, 0.78, -0.46).normalize();

/**
 * What stands far behind a lab that has no room, field or sky around it:
 * the depth of open water, the crowded inside of a cell, or open space. It
 * is one draw behind everything else, painted by the graphics card, with no
 * edge and no parallax, and it moves as slowly as the place does. The
 * camera leaves it out when it frames the lab.
 *
 * @param band - How bright the band of dust and unresolved stars is
 * @param body - The tone of the soft bodies that crowd the distance
 * @param crowd - How much of the distance those bodies fill, from 0 to 1
 * @param dim - How much of the backdrop's light shows, which a dark page lowers
 * @param disc - How bright the sun's disc and glare stand, 0 for none
 * @param glow - The tone of the light: shafts, ripples and lit pockets
 * @param grain - How many bodies cross a quarter turn of the view
 * @param high - The tone straight above
 * @param low - The tone straight below
 * @param ripple - How bright the net of light that ripples cast is
 * @param shafts - How bright the shafts of light from above are
 */
export function Backdrop({
  band = 0,
  body,
  crowd = 0,
  dim = 1,
  disc = 0,
  glow,
  grain = 3,
  high,
  low,
  ripple = 0,
  shafts = 0,
}: {
  readonly band?: number;
  readonly body: string;
  readonly crowd?: number;
  readonly dim?: number;
  readonly disc?: number;
  readonly glow: string;
  readonly grain?: number;
  readonly high: string;
  readonly low: string;
  readonly ripple?: number;
  readonly shafts?: number;
}) {
  const { sun, tier } = useStage();
  const rich = tier === "full" || tier === "light";
  const material = useMemo(
    () =>
      new ShaderMaterial({
        defines: rich ? { RICH: "" } : {},
        depthWrite: false,
        fragmentShader: FRAGMENT,
        side: BackSide,
        uniforms: {
          uBand: { value: band },
          uBody: { value: new Color(body) },
          uCrowd: { value: crowd },
          uDim: { value: dim },
          uDisc: { value: disc },
          uGlow: { value: new Color(glow) },
          uGrain: { value: grain },
          uHigh: { value: new Color(high) },
          uLow: { value: new Color(low) },
          uPole: { value: POLE },
          uRipple: { value: ripple },
          uShafts: { value: shafts },
          uSun: { value: new Vector3(...sun) },
          uTime: { value: 0 },
        },
        vertexShader: VERTEX,
      }),
    [
      band,
      body,
      crowd,
      dim,
      disc,
      glow,
      grain,
      high,
      low,
      rich,
      ripple,
      shafts,
      sun,
    ]
  );

  useEffect(() => () => material.dispose(), [material]);

  useFrame((_, delta) => {
    const { uTime } = material.uniforms;
    if (uTime !== undefined) {
      uTime.value += delta;
    }
  });

  return (
    <CameraBounds exclude>
      <mesh frustumCulled={false} material={material} renderOrder={-1000}>
        <icosahedronGeometry args={[1, 3]} />
      </mesh>
    </CameraBounds>
  );
}
