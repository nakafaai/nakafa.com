import { useTexture } from "@react-three/drei";
import { BLUE_MARBLE_EARTH_TEXTURE_ASSET } from "@repo/design-system/components/contents/biology/assets";
import {
  EARTH_RADIUS,
  SUN,
} from "@repo/design-system/components/contents/biology/climate/rays";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { MATERIAL } from "@repo/design-system/lib/material";
import { useEffect, useMemo } from "react";
import {
  AdditiveBlending,
  BackSide,
  Color,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
} from "three";

/** How far the glow of the atmosphere reaches, past the highest molecules. */
const SHELL_RADIUS = 1.55;

/** The direction toward the Sun, which lights the day side. */
const SUN_DIRECTION = new Vector3(...SUN.position).normalize();

/**
 * The Blue Marble lit by the Sun: full daylight where it stands overhead, a
 * soft terminator, a night side kept just visible, and the blue of the air
 * thickening toward the limb, brighter on the day side.
 */
const EARTH_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorld;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vUv = uv;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const EARTH_FRAGMENT = /* glsl */ `
uniform vec3 limb;
uniform sampler2D map;
uniform vec3 sun;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorld;

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(cameraPosition - vWorld);
  float light = dot(n, sun);
  float day = smoothstep(-0.14, 0.3, light);
  vec3 albedo = texture2D(map, vUv).rgb;
  vec3 color = albedo * (0.17 + 0.83 * day * (0.35 + 0.85 * max(light, 0.0)));
  float rim = pow(1.0 - max(dot(n, v), 0.0), 2.4);
  color += limb * rim * (0.22 + 0.78 * smoothstep(-0.35, 0.45, light));
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * The atmosphere seen from space: for each line of sight, the glow of the air
 * it grazes, by how close it passes to the surface. A thin bright limb sits
 * on the surface and a faint haze reaches out through the molecules, both
 * brighter on the day side. Drawn on the inside of a shell, so the Earth and
 * the molecules in front hide the part behind them.
 */
const LIMB_VERTEX = /* glsl */ `
varying vec3 vCenter;
varying vec3 vWorld;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const LIMB_FRAGMENT = /* glsl */ `
uniform vec3 color;
uniform float earth;
uniform float shell;
uniform float strength;
uniform vec3 sun;
varying vec3 vCenter;
varying vec3 vWorld;

void main() {
  vec3 center = vCenter;
  vec3 sight = normalize(vWorld - cameraPosition);
  vec3 closest = cameraPosition + sight * dot(center - cameraPosition, sight);
  float pass = length(closest - center);
  float height = max(pass - earth, 0.0);
  float glow = 0.9 * exp(-height / 0.045) + 0.34 * exp(-height / 0.2);
  glow *= 1.0 - smoothstep(shell * 0.84, shell, pass);
  float lit = 0.28 + 0.72 * smoothstep(-0.5, 0.5, dot(normalize(closest - center), sun));
  gl_FragColor = vec4(color * glow * lit * strength, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** The Earth, which turns inside the group that holds it. */
export function Earth() {
  const texture = useTexture(BLUE_MARBLE_EARTH_TEXTURE_ASSET.path);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  const material = useMemo(
    () =>
      new ShaderMaterial({
        fragmentShader: EARTH_FRAGMENT,
        uniforms: {
          limb: { value: new Color(MATERIAL.atmosphereLimb) },
          map: { value: texture },
          sun: { value: SUN_DIRECTION },
        },
        vertexShader: EARTH_VERTEX,
      }),
    [texture]
  );
  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh material={material} rotation={[0.1, -1.28, 0]}>
      <sphereGeometry args={[EARTH_RADIUS, 128, 64]} />
    </mesh>
  );
}

/**
 * The glow of the atmosphere around the Earth, which thickens a little as the
 * gas level `level` rises.
 */
export function Atmosphere({ level }: { readonly level: number }) {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        blending: AdditiveBlending,
        depthWrite: false,
        fragmentShader: LIMB_FRAGMENT,
        side: BackSide,
        transparent: true,
        uniforms: {
          color: { value: new Color(MATERIAL.atmosphereLimb) },
          earth: { value: EARTH_RADIUS },
          shell: { value: SHELL_RADIUS },
          strength: { value: 1 },
          sun: { value: SUN_DIRECTION },
        },
        vertexShader: LIMB_VERTEX,
      }),
    []
  );
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    const strength = material.uniforms.strength;
    if (strength !== undefined) {
      strength.value = 0.62 + 0.1 * level;
    }
  }, [level, material]);

  return (
    <CameraBounds exclude>
      <mesh material={material}>
        <sphereGeometry args={[SHELL_RADIUS, 96, 48]} />
      </mesh>
    </CameraBounds>
  );
}

useTexture.preload(BLUE_MARBLE_EARTH_TEXTURE_ASSET.path);
