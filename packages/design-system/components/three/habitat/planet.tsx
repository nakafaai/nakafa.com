import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { BLUE_MARBLE_EARTH_TEXTURE_ASSET } from "@repo/design-system/components/contents/biology/assets";
import { paintClouds } from "@repo/design-system/components/three/habitat/clouds";
import { ECOLOGY_COLORS } from "@repo/design-system/lib/material/ecology";
import { useEffect, useMemo } from "react";
import {
  AdditiveBlending,
  BackSide,
  Color,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  MirroredRepeatWrapping,
  RedFormat,
  RepeatWrapping,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
} from "three";

/**
 * The size of the painted weather, around the equator and from pole to pole.
 * It holds only the broad systems; the shader adds the fine structure.
 */
const COVER = { height: 80, width: 160 } as const;

/** How far above the ground the cloud deck floats, as a share of the radius. */
const CLOUD_LIFT = 1.008;

/** How fast the weather drifts east over the ground, in radians a second. */
const DRIFT = 0.0035;

/**
 * The measured ground and sea of each planet a lab can show, as the image
 * wrapped around its sphere. Real coastlines, deserts, forests and ice
 * cannot be invented without looking like a toy globe, so this is the one
 * place a lab's planet reads measured data; everything drawn over it is
 * worked out here.
 */
const BODIES = { earth: BLUE_MARBLE_EARTH_TEXTURE_ASSET.path } as const;

/** The blue the air scatters toward an eye in space. */
const AIR_COLOR = ECOLOGY_COLORS.airScatter;

/**
 * Reads how thick the cloud stands over a place of the sphere, from 0 for
 * clear air to 1 for a dense deck, with no hard edge anywhere: the painted
 * systems of weather, pushed about and broken into billows and wisps by
 * layered noise read in space, so it has no seam and stays fine however near
 * the camera comes. The weather drifts east over the ground.
 */
const COVER_CHUNK = /* glsl */ `
uniform sampler2D cover;
uniform float drift;

float chance(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.17, 0.23));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float grain(vec3 p) {
  vec3 cell = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(chance(cell), chance(cell + vec3(1.0, 0.0, 0.0)), f.x),
        mix(chance(cell + vec3(0.0, 1.0, 0.0)), chance(cell + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(chance(cell + vec3(0.0, 0.0, 1.0)), chance(cell + vec3(1.0, 0.0, 1.0)), f.x),
        mix(chance(cell + vec3(0.0, 1.0, 1.0)), chance(cell + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}

float layered(vec3 p) {
  float sum = 0.0;
  float weight = 0.5;
  for (int layer = 0; layer < 3; layer++) {
    sum += grain(p) * weight;
    p = p * 2.03 + vec3(7.1, 3.3, 5.7);
    weight *= 0.5;
  }
  return sum / 0.875;
}

float billowed(vec3 p) {
  float sum = 0.0;
  float weight = 0.5;
  for (int layer = 0; layer < 5; layer++) {
    sum += grain(p) * weight;
    p = p * 2.03 + vec3(7.1, 3.3, 5.7);
    weight *= 0.5;
  }
  return sum / 0.96875;
}

/** A place or a direction as the drifting weather sees it. */
vec3 drifted(vec3 place) {
  float c = cos(drift);
  float s = sin(drift);
  return vec3(place.x * c + place.z * s, place.y, place.z * c - place.x * s);
}

/** How thick the cloud stands over a place, itself already drifted. */
float coverAt(vec3 place) {
  float east = atan(place.z, place.x) / 6.2831853;
  float wrapped = fract(east);
  float across = fwidth(east) < fwidth(wrapped) ? east : wrapped;
  float broad = texture2D(cover, vec2(across, asin(clamp(place.y, -1.0, 1.0)) / 3.1415927 + 0.5)).r;
  vec3 slow = place * 4.6;
  vec3 push = vec3(layered(slow + 11.3), layered(slow + 37.1), layered(slow + 71.7)) - 0.5;
  float billow = billowed(place * 10.5 + push * 2.1);
  float wisp = layered(place * 36.0 + push * 4.4);
  float field = broad + (billow - 0.5) * 0.58 + (wisp - 0.5) * 0.17;
  return smoothstep(0.38, 1.0, field);
}
`;

/**
 * What the ground and the cloud deck share: each point's place on the
 * sphere, its normal in the scene, and the direction toward the sun as the
 * turning planet sees it.
 */
const SPHERE_VERTEX = /* glsl */ `
uniform vec3 sun;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPlace;
varying vec3 vSunLocal;
varying vec3 vWorld;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vUv = uv;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vPlace = normalize(position);
  vSunLocal = normalize(sun * mat3(modelMatrix));
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/**
 * The ground and sea of a planet lit by its sun: daylight that falls off
 * toward the terminator, the shadows its clouds cast, deeper under thicker
 * cloud, the glint of the sun on open water, a warm band of dusk, a night
 * side kept just visible, and the blue the air scatters into the view
 * toward the limb.
 */
const GROUND_FRAGMENT = /* glsl */ `
uniform vec3 air;
uniform sampler2D map;
uniform vec3 sun;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPlace;
varying vec3 vSunLocal;
varying vec3 vWorld;
${COVER_CHUNK}

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(cameraPosition - vWorld);
  float light = dot(n, sun);
  float day = smoothstep(-0.08, 0.2, light);
  vec3 albedo = texture2D(map, vUv).rgb;
  albedo = mix(vec3(dot(albedo, vec3(0.2126, 0.7152, 0.0722))), albedo, 1.18);
  float sea = smoothstep(0.012, 0.06, albedo.b - max(albedo.r, albedo.g * 0.82));
  vec3 place = drifted(normalize(vPlace));
  vec3 toSun = drifted(normalize(vSunLocal));
  float shade = coverAt(normalize(place + toSun * 0.022));
  float over = coverAt(place);

  vec3 lit = albedo * (0.05 + 1.36 * max(light, 0.0)) * (1.0 - 0.46 * shade * shade);
  float facing = max(dot(n, normalize(sun + v)), 0.0);
  float glint = pow(facing, 160.0) * 2.4 + pow(facing, 22.0) * 0.2;
  float graze = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  lit += (vec3(1.0, 0.95, 0.86) * glint + air * 0.22 * graze) * sea * (1.0 - over) * day;

  vec3 night = albedo * vec3(0.04, 0.05, 0.075) + vec3(0.002, 0.004, 0.01);
  vec3 color = mix(night, lit, day);
  float dusk = exp(-pow(light / 0.11, 2.0));
  color *= mix(vec3(1.0), vec3(1.22, 0.74, 0.48), dusk * 0.65);

  float rim = pow(1.0 - max(dot(n, v), 0.0), 2.6);
  float lightAir = smoothstep(-0.25, 0.4, light);
  color = mix(color, air * lightAir, 0.02 + 0.4 * rim);
  color += air * rim * 0.36 * lightAir;
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * The cloud deck above the ground, as thick or as thin as the weather is
 * there: a veil the ground shows through where it is thin, a bright core
 * where it is dense, grey on the side away from the sun where thicker cloud
 * shades it, warm at dusk and dark at night.
 */
const CLOUD_FRAGMENT = /* glsl */ `
uniform vec3 sun;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPlace;
varying vec3 vSunLocal;
varying vec3 vWorld;
${COVER_CHUNK}

void main() {
  vec3 n = normalize(vNormal);
  float light = dot(n, sun);
  float day = smoothstep(-0.1, 0.18, light);
  vec3 place = drifted(normalize(vPlace));
  vec3 toSun = drifted(normalize(vSunLocal));
  float here = coverAt(place);
  float toward = coverAt(normalize(place + toSun * 0.009));
  float shaded = smoothstep(0.0, 0.5, toward - here * 0.55);
  float body = (0.74 + 0.26 * here) * (1.0 - 0.34 * shaded);
  vec3 color = vec3(body * (0.03 + 1.24 * max(light, 0.0)));
  float dusk = exp(-pow(light / 0.12, 2.0));
  color *= mix(vec3(1.0), vec3(1.25, 0.7, 0.42), dusk * 0.7);
  color = mix(vec3(0.02, 0.024, 0.034), color, day);
  gl_FragColor = vec4(color, pow(here, 1.3) * 0.97);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * The air seen from space: for each line of sight past the planet, the glow
 * of the air it grazes by how close it passes to the ground. A thin pale band
 * hugs the limb and a deep blue haze reaches out above it, both lit only on
 * the day side and warm where the sun is setting. Drawn on the inside of a
 * shell, so the planet and whatever floats in front hide the part behind.
 */
const AIR_VERTEX = /* glsl */ `
varying vec3 vCenter;
varying vec3 vWorld;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/** The glow of the air along one line of sight, by how close it passes to the ground. */
const AIR_FRAGMENT = /* glsl */ `
uniform vec3 color;
uniform float depth;
uniform float ground;
uniform float shell;
uniform float strength;
uniform vec3 sun;
varying vec3 vCenter;
varying vec3 vWorld;

void main() {
  vec3 sight = normalize(vWorld - cameraPosition);
  vec3 closest = cameraPosition + sight * dot(vCenter - cameraPosition, sight);
  float pass = length(closest - vCenter);
  float height = max(pass - ground, 0.0);
  float thin = exp(-height / depth);
  float wide = exp(-height / (depth * 4.5));
  float facing = dot(normalize(closest - vCenter), sun);
  float lit = 0.03 + 0.97 * smoothstep(-0.3, 0.32, facing);
  float dusk = exp(-pow(facing / 0.2, 2.0));
  vec3 tone = mix(color, vec3(0.78, 0.9, 1.0), thin * 0.7);
  tone = mix(tone, vec3(1.0, 0.46, 0.2), dusk * 0.6 * thin);
  float glow = (1.05 * thin + 0.34 * wide) * (1.0 - smoothstep(shell * 0.84, shell, pass));
  gl_FragColor = vec4(tone * glow * lit * strength, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** Paints a planet's weather once, as a texture that wraps around its sphere. */
function coverTexture(seed: number) {
  const texture = new DataTexture(
    paintClouds(COVER.width, COVER.height, seed),
    COVER.width,
    COVER.height,
    RedFormat
  );
  texture.wrapS = RepeatWrapping;
  texture.wrapT = MirroredRepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/**
 * A planet seen from orbit: its ground and sea under drifting weather, lit
 * by one sun. The clouds run from thin veils to dense bright decks, in
 * bands and winding storms, and shade the ground and each other by how
 * thick they are; open water glints, dusk runs warm along the terminator
 * and the night side stays just visible. It turns with the group that holds
 * it, the weather drifts slowly east over it whenever the scene draws, and
 * the sun stays where the scene puts it.
 *
 * @param body - Which planet: its measured ground and sea come with it
 * @param radius - The planet's radius, in scene units
 * @param sun - The direction toward the sun, in the scene
 * @param weather - Which weather the planet has
 */
export function Planet({
  body,
  radius,
  sun,
  weather = 7,
}: {
  readonly body: keyof typeof BODIES;
  readonly radius: number;
  readonly sun: readonly [number, number, number];
  readonly weather?: number;
}) {
  const [sunX, sunY, sunZ] = sun;
  const map = useTexture(BODIES[body]);
  const parts = useMemo(() => {
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = 8;
    const cover = coverTexture(weather);
    const toward = new Vector3(sunX, sunY, sunZ).normalize();
    const drift = { value: 0 };
    const ground = new ShaderMaterial({
      fragmentShader: GROUND_FRAGMENT,
      uniforms: {
        air: { value: new Color(AIR_COLOR) },
        cover: { value: cover },
        drift,
        map: { value: map },
        sun: { value: toward },
      },
      vertexShader: SPHERE_VERTEX,
    });
    const clouds = new ShaderMaterial({
      depthWrite: false,
      fragmentShader: CLOUD_FRAGMENT,
      transparent: true,
      uniforms: { cover: { value: cover }, drift, sun: { value: toward } },
      vertexShader: SPHERE_VERTEX,
    });
    return { clouds, cover, drift, ground };
  }, [map, sunX, sunY, sunZ, weather]);
  useFrame((_, delta) => {
    parts.drift.value += Math.min(delta, 0.1) * DRIFT;
  });
  useEffect(
    () => () => {
      parts.clouds.dispose();
      parts.cover.dispose();
      parts.ground.dispose();
    },
    [parts]
  );

  return (
    <group>
      <mesh material={parts.ground}>
        <sphereGeometry args={[radius, 160, 80]} />
      </mesh>
      <mesh material={parts.clouds} renderOrder={1}>
        <sphereGeometry args={[radius * CLOUD_LIFT, 160, 80]} />
      </mesh>
    </group>
  );
}

/**
 * The air around a planet, seen from space as the glow along its limb: a
 * thin pale band on the ground and a blue haze above it, lit on the day side
 * and warm at the terminator.
 *
 * @param radius - The planet's radius, in scene units
 * @param reach - How far from the planet's middle the haze fades out
 * @param depth - How fast the air thins with height: the height at which the
 * bright band has faded to about a third
 * @param strength - How bright the glow is, 1 for clear air
 * @param sun - The direction toward the sun, in the scene
 */
export function Air({
  depth,
  radius,
  reach,
  strength = 1,
  sun,
}: {
  readonly depth: number;
  readonly radius: number;
  readonly reach: number;
  readonly strength?: number;
  readonly sun: readonly [number, number, number];
}) {
  const [sunX, sunY, sunZ] = sun;
  const material = useMemo(
    () =>
      new ShaderMaterial({
        blending: AdditiveBlending,
        depthWrite: false,
        fragmentShader: AIR_FRAGMENT,
        side: BackSide,
        transparent: true,
        uniforms: {
          color: { value: new Color(AIR_COLOR) },
          depth: { value: depth },
          ground: { value: radius },
          shell: { value: reach },
          strength: { value: 1 },
          sun: { value: new Vector3(sunX, sunY, sunZ).normalize() },
        },
        vertexShader: AIR_VERTEX,
      }),
    [depth, radius, reach, sunX, sunY, sunZ]
  );
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    material.uniforms.strength = { value: strength };
  }, [material, strength]);

  return (
    <mesh material={material} renderOrder={2}>
      <sphereGeometry args={[reach, 96, 48]} />
    </mesh>
  );
}

useTexture.preload(BODIES.earth);
