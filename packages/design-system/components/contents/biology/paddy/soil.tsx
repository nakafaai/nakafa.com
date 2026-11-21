import { useFrame } from "@react-three/fiber";
import {
  XRAY,
  XRAY_GLOW,
  XRAY_GLSL,
  XRAY_VERTEX,
  xrayUniforms,
} from "@repo/design-system/components/contents/biology/paddy/xray";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { PADDY_COLORS } from "@repo/design-system/lib/material/paddy";
import type { RefObject } from "react";
import { useEffect, useMemo } from "react";
import {
  BackSide,
  CircleGeometry,
  Color,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";

/** How far the field's surface runs from the middle every way, in metres: past the haze. */
export const FIELD_RADIUS = 28;

/**
 * How far the soil under the X-ray window reaches round the zone and how
 * deep, in metres: past every ray the window lets through, and below the
 * plough pan.
 */
const VOLUME = { depth: 0.45, radius: 1.6 } as const;

/** How much of the mud's surface still shows in the middle of the X-ray window. */
const GHOST = 0.2;

/**
 * The field's surface seen from above: wet mud with bits of last season's
 * straw under the floodwater, or drained soil, painted by noise, with its
 * fine relief.
 */
const MUD_GLSL = /* glsl */ `
uniform vec3 uMud;
uniform vec3 uDrained;
uniform vec3 uDrainedLight;

float mudFbm(vec2 p) {
  float sum = 0.0;
  float weight = 0.5;
  for (int octave = 0; octave < 5; octave++) {
    sum += weight * xrayNoise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    weight *= 0.5;
  }
  return sum / 0.96875;
}

vec3 mudColor(vec2 p) {
  float broad = mudFbm(p * 1.3);
  float fine = mudFbm(p * 40.0);
  float straw = smoothstep(0.8, 0.88, xrayNoise(vec2(p.x * 120.0, p.y * 9.0)));
  vec3 wet = mix(uMud * 0.8, uMud * 1.12, broad);
  vec3 dry = mix(uDrained * 0.92, uDrainedLight, broad);
  vec3 color = mix(dry, wet, uFlood) * (0.86 + 0.28 * fine);
  return mix(color, uDrainedLight * 1.25, straw * 0.35);
}

float mudHeight(vec2 p) {
  return mudFbm(p * 90.0) * 0.0006 + mudFbm(p * 11.0) * 0.002;
}

vec3 mudBump(vec3 position, vec3 normal, float height, float facing) {
  vec3 sigmaX = dFdx(position);
  vec3 sigmaY = dFdy(position);
  vec3 r1 = cross(sigmaY, normal);
  vec3 r2 = cross(normal, sigmaX);
  float det = dot(sigmaX, r1) * facing;
  vec3 gradient = sign(det) * (dFdx(height) * r1 + dFdy(height) * r2);
  return normalize(abs(det) * normal - gradient);
}
`;

/** Keeps a material's `uFlood` uniform on the field's degree of flooding. */
function useFloodUniform(uniform: { value: number }, flood: RefObject<number>) {
  useFrame(() => {
    uniform.value = flood.current;
  });
}

/**
 * The field's soil surface to the haze every way: wet mud with straw under
 * the floodwater, or drained soil. Over the roots it thins to a ghost of
 * itself, the X-ray window, fading back to solid mud all round, so the soil
 * and roots under it show with no edge anywhere.
 */
export function MudSurface({ flood }: { readonly flood: RefObject<number> }) {
  const { geometry, material, uniform } = useMemo(() => {
    const uniforms = {
      ...xrayUniforms(),
      uDrained: { value: new Color(PADDY_COLORS.drained) },
      uDrainedLight: { value: new Color(PADDY_COLORS.drainedLight) },
      uMud: { value: new Color(PADDY_COLORS.mudSurface) },
    };
    const mud = new MeshStandardMaterial({
      metalness: 0,
      roughness: 0.8,
      transparent: true,
    });
    mud.onBeforeCompile = (shader) => {
      shader.uniforms = { ...shader.uniforms, ...uniforms };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vXray;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>\n${XRAY_VERTEX}`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>\n${XRAY_GLSL}\n${MUD_GLSL}`
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
diffuseColor.rgb = mudColor(vXray.xz);
diffuseColor.a = 1.0 - ${(1 - GHOST).toFixed(2)} * xrayWindow(vXray.xz);`
        )
        .replace(
          "#include <roughnessmap_fragment>",
          "#include <roughnessmap_fragment>\nroughnessFactor = mix(0.86, 0.35, uFlood);"
        )
        .replace(
          "#include <normal_fragment_maps>",
          "#include <normal_fragment_maps>\nnormal = mudBump(-vViewPosition, normal, mudHeight(vXray.xz), faceDirection);"
        );
    };
    mud.customProgramCacheKey = () => "paddy-mud";
    const disc = new CircleGeometry(FIELD_RADIUS, 128);
    disc.rotateX(-Math.PI / 2);
    return { geometry: disc, material: mud, uniform: uniforms.uFlood };
  }, []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );
  useFloodUniform(uniform, flood);

  return (
    <CameraBounds exclude>
      <mesh
        geometry={geometry}
        material={material}
        receiveShadow
        renderOrder={1}
      />
    </CameraBounds>
  );
}

/**
 * The soil under the X-ray window as the camera sees into it: the colour of
 * each layer it looks through, dimmed with distance, from the surface down
 * to the far side of a bowl that reaches past every ray the window lets
 * through. The bowl is never seen: solid mud covers it all round.
 */
export function SoilVolume({ flood }: { readonly flood: RefObject<number> }) {
  const { geometry, material, uniform } = useMemo(() => {
    const uniforms = xrayUniforms();
    const soil = new MeshStandardMaterial({
      metalness: 0,
      roughness: 1,
      side: BackSide,
    });
    soil.onBeforeCompile = (shader) => {
      shader.uniforms = { ...shader.uniforms, ...uniforms };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vXray;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>\n${XRAY_VERTEX}`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${XRAY_GLSL}`)
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
vec4 seen = xraySoil(vXray);
diffuseColor.rgb = seen.rgb + (1.0 - seen.a) * xrayLayer(vXray);`
        )
        .replace(
          "#include <normal_fragment_maps>",
          "#include <normal_fragment_maps>\nnormal = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);"
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>\ntotalEmissiveRadiance = diffuseColor.rgb * ${XRAY_GLOW.toFixed(2)};`
        );
    };
    soil.customProgramCacheKey = () => "paddy-soil-volume";
    const bowl = new SphereGeometry(
      1,
      72,
      18,
      0,
      Math.PI * 2,
      Math.PI / 2,
      Math.PI / 2
    );
    bowl.scale(VOLUME.radius, VOLUME.depth, VOLUME.radius);
    bowl.translate(XRAY.zone[0], -0.001, XRAY.zone[1]);
    return { geometry: bowl, material: soil, uniform: uniforms.uFlood };
  }, []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );
  useFloodUniform(uniform, flood);

  return (
    <CameraBounds exclude>
      <mesh geometry={geometry} material={material} />
    </CameraBounds>
  );
}
