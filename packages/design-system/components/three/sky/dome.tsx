import { useFrame } from "@react-three/fiber";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import type { Air } from "@repo/design-system/components/three/sky/air";
import { AIR_SHADER } from "@repo/design-system/components/three/sky/air";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { useEffect, useMemo } from "react";
import { BackSide, ShaderMaterial, Vector3 } from "three";

/** Keeps the sky at the far end of every view, turning with the camera alone. */
const VERTEX = `
varying vec3 vWay;
void main() {
  vWay = position;
  gl_Position = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position.z = gl_Position.w;
}
`;

/**
 * Paints the sky in one direction. The air scatters the light of the sun or
 * the moon (blue overhead, pale at the horizon, bright around the light),
 * and at night the last light of the set sun lies along the horizon under
 * stars of every brightness and colour and the faint band of the Milky Way.
 * The sun or the moon stands in it as a disc with its glare. Two layers of
 * cloud drift across: heaped fair-weather clouds, lit on the side that faces
 * the light and shadowed where the light has crossed more cloud, and thin
 * high streaks. Clouds take the tone of the air with distance, and the whole
 * sky runs into the haze at the horizon and below it, so it has no edge.
 */
const FRAGMENT = `
uniform vec3 uSun;
uniform vec3 uGlow;
uniform vec3 uLight;
uniform vec3 uHaze;
uniform vec3 uPole;
uniform float uCover;
uniform float uDisc;
uniform float uTime;
varying vec3 vWay;
${AIR_SHADER}
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
  for (int layer = 0; layer < LAYERS; layer++) {
    sum += weight * noise(p);
    p = p * 2.07 + vec3(11.7, 3.1, 5.3);
    weight *= 0.5;
  }
  return sum;
}
float heap(vec2 at) {
  float broad = layered(vec3(at * 0.55, uTime * 0.004));
  float fine = layered(vec3(at * 1.9 + 4.0, uTime * 0.007));
  return smoothstep(0.86 - 0.5 * uCover, 1.08 - 0.5 * uCover, broad + 0.42 * fine + 0.2);
}
void main() {
  vec3 way = normalize(vWay);
  float height = way.y;
  float toward = dot(way, uSun);
  vec3 tone = airGlow(height, toward, uGlow);
  float near = max(0.0, toward);
#ifdef NIGHT
  vec2 set = -normalize(uSun.xz + vec2(0.0001));
  tone += duskGlow(height, dot(normalize(way.xz + vec2(0.0001)), set));
#ifdef DISC
  vec3 cell = way * 120.0;
  vec3 id = floor(cell);
  vec3 spot = fract(cell) - 0.5 - 0.7 * (vec3(chance(id + 11.3), chance(id + 27.1), chance(id + 41.7)) - 0.5);
  float rank = chance(id);
  float bright = pow(rank, 12.0);
  float star = step(0.5, rank) * smoothstep(0.08 + 0.1 * bright, 0.0, length(spot)) * (0.12 + 5.0 * bright);
  vec3 hue = mix(vec3(1.0, 0.74, 0.52), vec3(0.7, 0.82, 1.0), chance(id + 5.5));
  float along = dot(way, uPole);
  float band = exp(-16.0 * along * along) * (0.3 + layered(way * 3.4 + vec3(5.0))) * (1.0 - 0.7 * smoothstep(0.5, 0.7, layered(way * 7.0)));
  float clear = smoothstep(0.02, 0.3, height);
  tone += clear * (hue * star + vec3(0.62, 0.7, 1.0) * 0.016 * band);
  float face = smoothstep(0.99972, 0.9998, toward);
  float seas = 0.72 + 0.28 * smoothstep(0.35, 0.65, noise(way * 90.0));
  tone = mix(tone, uLight * 3.2 * seas, uDisc * face);
  tone += uDisc * uLight * (0.4 * pow(near, 900.0) + 0.035 * pow(near, 30.0));
#endif
#else
  tone += uDisc * uLight * (60.0 * smoothstep(0.99994, 0.99997, toward) + 1.4 * pow(near, 1400.0) + 0.22 * pow(near, 60.0));
#endif
  vec2 over = way.xz / (max(height, 0.0) + 0.09);
  vec2 lit = normalize(uSun.xz + vec2(0.0001)) * 0.32;
  float heaped = heap(over);
  float crossed = heap(over + lit);
  float sunlit = exp(-1.9 * crossed) * (0.55 + 0.45 * heaped);
  vec3 shade = uLight * LIT * 0.5 + airGlow(0.6, 0.0, uGlow) * 0.5;
  vec3 cloud = mix(shade, uLight * LIT, sunlit) + uLight * LIT * 0.5 * pow(near, 10.0) * (1.0 - heaped);
  float far = exp(-0.06 * length(over));
  float streak = smoothstep(0.5, 0.82, layered(vec3(over.x * 0.22 + 9.0, over.y * 0.9, uTime * 0.003)));
  tone = mix(tone, mix(uHaze, uLight * LIT * 0.8, far), 0.2 * uCover * streak * far);
  tone = mix(tone, mix(uHaze, cloud, far), heaped * 0.96 * smoothstep(0.0, 0.08, height));
  tone = mix(uHaze, tone, smoothstep(0.0, 0.07, height));
  gl_FragColor = vec4(tone, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** The axis the band of the Milky Way circles. */
const POLE = new Vector3(0.42, 0.78, -0.46).normalize();

/**
 * The open sky around a lab: one draw behind everything else, painted by
 * the graphics card from the air of the place, with no edge and no
 * parallax, its clouds drifting slowly. The camera leaves it out when it
 * frames the lab. Drawn as the lab's light, it shows neither the disc of
 * the sun nor the stars, because the key light already stands for the sun
 * and a point of light would speckle every reflection.
 *
 * @param air - The air of the place, which the key light and the haze share
 * @param light - Whether this sky is drawn as the light it throws on the lab
 */
export function Dome({
  air,
  light = false,
}: {
  readonly air: Air;
  readonly light?: boolean;
}) {
  const { sun, tier } = useStage();
  const rich = tier === "full" || tier === "light";
  const material = useMemo(
    () =>
      new ShaderMaterial({
        defines: {
          LAYERS: rich && !light ? 5 : 3,
          LIT: air.night ? "0.34" : "1.25",
          ...(air.night ? { NIGHT: "" } : {}),
          ...(light ? {} : { DISC: "" }),
        },
        depthWrite: false,
        fragmentShader: FRAGMENT,
        side: BackSide,
        uniforms: {
          uCover: { value: air.cover },
          uDisc: { value: light ? 0 : 1 },
          uGlow: { value: new Vector3(...air.glow) },
          uHaze: { value: new Vector3(...air.haze) },
          uLight: { value: new Vector3(...air.light) },
          uPole: { value: POLE },
          uSun: { value: new Vector3(...sun) },
          uTime: { value: 0 },
        },
        vertexShader: VERTEX,
      }),
    [air, light, rich, sun]
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
