import { PADDY_COLORS } from "@repo/design-system/lib/material/paddy";
import type { WebGLProgramParametersWithUniforms } from "three";
import { Color } from "three";

type SoilShader = Pick<
  WebGLProgramParametersWithUniforms,
  "fragmentShader" | "uniforms" | "vertexShader"
>;

interface SoilMaterial<
  TShader extends SoilShader,
  TRest extends readonly unknown[],
> {
  customProgramCacheKey: () => string;
  onBeforeCompile: (shader: TShader, ...rest: TRest) => void;
}

/**
 * The X-ray view into the soil. `zone` is the middle of the patch of field
 * whose roots it shows, on the soil surface (x, z), in metres; `depth` is the
 * depth it centres on. The see-through window in the mud and water moves
 * toward the camera by as far as that depth looks shifted from where the
 * camera stands, so the same roots stay in view from any side; `radius` is
 * the window's radius and `fade` the share of it, from the middle, that is
 * fully see-through before it fades into the solid mud.
 */
export const XRAY = {
  depth: 0.12,
  fade: 0.35,
  radius: 0.95,
  zone: [0, -0.15],
} as const;

/**
 * How strongly soil dims what lies behind it in the X-ray view, per metre of
 * soil looked through: a root 10 cm down shows at a little over half its
 * strength. The denser plough pan dims four times as much, so it shows as a
 * layer.
 */
const DENSITY = 2.2;

/**
 * How much the soil in the X-ray view glows with its own colour, as if lit
 * from within, against the light it reflects: enough that grey mud reads as
 * mud under the water rather than as dark water.
 */
export const XRAY_GLOW = 1.2;

/**
 * The oxidised skin of flooded mud: how deep it reaches, in metres (a few
 * millimetres to about a centimetre, Ponnamperuma 1972), and how strongly it
 * dims per metre looked through, so its rusty brown shows as a thin layer
 * over the grey mud.
 */
const SKIN = { density: 14, depth: 0.012 } as const;

/** Steps the soil is sampled at below the skin, between it and a point under it. */
const STEPS = 14;

/** A number as a GLSL float literal. */
function float(value: number) {
  return value.toFixed(4);
}

/**
 * The GLSL every X-ray material shares: the see-through window, the soil's
 * colour at a depth (a thin brown oxidised skin over grey reduced mud down to
 * the plough pan when flooded, brown throughout when drained, then the pan
 * and the subsoil, after Ponnamperuma 1972), and the soil between the
 * surface and a point under it, as the camera sees it.
 */
export const XRAY_GLSL = /* glsl */ `
uniform float uFlood;
uniform vec3 uXrayOxidised;
uniform vec3 uXrayReduced;
uniform vec3 uXrayReducedDark;
uniform vec3 uXrayPan;
uniform vec3 uXraySubsoil;
uniform vec3 uXrayDrained;
varying vec3 vXray;

float xrayHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float xrayNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(xrayHash(i), xrayHash(i + vec2(1.0, 0.0)), u.x),
    mix(xrayHash(i + vec2(0.0, 1.0)), xrayHash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float xrayWindow(vec2 surface) {
  vec2 zone = vec2(${float(XRAY.zone[0])}, ${float(XRAY.zone[1])});
  vec2 toward = cameraPosition.xz - zone;
  float run = max(length(toward), 0.001);
  float rise = max(cameraPosition.y, 0.05);
  vec2 middle = zone + toward / run * min(${float(XRAY.depth)} * run / rise, 0.5);
  float reach = length(surface - middle) / ${float(XRAY.radius)};
  return 1.0 - smoothstep(${float(XRAY.fade)}, 1.0, reach);
}

float xrayPan(float depth) {
  return smoothstep(0.165, 0.18, depth) * (1.0 - smoothstep(0.205, 0.24, depth));
}

vec3 xrayLayer(vec3 point) {
  float depth = -point.y;
  float broad = xrayNoise(point.xz * 6.0 + depth * 9.0);
  float grain = 0.6 * broad + 0.4 * xrayNoise(point.xz * 43.0 + depth * 31.0);
  vec3 wet = mix(uXrayReducedDark, uXrayReduced, broad);
  vec3 dry = mix(uXrayDrained * 0.86, uXrayDrained * 1.08, broad);
  vec3 plough = mix(dry, wet, uFlood) * (0.8 + 0.4 * grain);
  vec3 color = mix(plough, uXrayPan * (0.62 + 0.2 * grain), xrayPan(depth));
  return mix(color, uXraySubsoil * (0.8 + 0.3 * grain), smoothstep(0.205, 0.24, depth));
}

vec4 xraySoil(vec3 point) {
  vec3 ray = point - cameraPosition;
  float entry = clamp(-cameraPosition.y / min(ray.y, -0.0001), 0.0, 1.0);
  vec3 start = cameraPosition + ray * entry;
  float deepest = max(-point.y, 0.0001);
  float skin = min(deepest, ${float(SKIN.depth)}) / deepest;
  float skinDim = 1.0 - exp(-${float(SKIN.density)} * uFlood * length(point - start) * skin);
  vec3 color = skinDim * uXrayOxidised;
  float through = 1.0 - skinDim;
  vec3 below = start + (point - start) * skin;
  vec3 stride = (point - below) / ${float(STEPS)};
  float span = length(stride);
  for (int index = 0; index < ${STEPS}; index++) {
    vec3 spot = below + stride * (float(index) + 0.5);
    float density = ${float(DENSITY)} * (1.0 + 3.0 * xrayPan(max(-spot.y, 0.0)));
    float dim = 1.0 - exp(-density * span);
    color += through * dim * xrayLayer(spot);
    through *= 1.0 - dim;
  }
  return vec4(color, 1.0 - through);
}
`;

/** The vertex lines that hand each point's place in the world to the X-ray GLSL, instanced or not. */
export const XRAY_VERTEX = /* glsl */ `
vec4 xrayWorld = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
xrayWorld = instanceMatrix * xrayWorld;
#endif
vXray = (modelMatrix * xrayWorld).xyz;
`;

/**
 * The uniforms of the X-ray GLSL: the soil's colours, and `uFlood`, which
 * eases the soil between drained (0) and flooded (1).
 */
export function xrayUniforms() {
  const color = (hex: string) => ({ value: new Color(hex) });
  return {
    uFlood: { value: 1 },
    uXrayDrained: color(PADDY_COLORS.drained),
    uXrayOxidised: color(PADDY_COLORS.oxidised),
    uXrayPan: color(PADDY_COLORS.pan),
    uXrayReduced: color(PADDY_COLORS.reduced),
    uXrayReducedDark: color(PADDY_COLORS.reducedDark),
    uXraySubsoil: color(PADDY_COLORS.subsoil),
  };
}

/**
 * Lets a standard or physical material lie under the soil in the X-ray view:
 * the soil between the surface and each point hides it in proportion,
 * turning its colour to the soil's, its gloss to matt and its facing to the
 * sky's, as the soil around it is lit. The soil's flooding follows
 * `uniforms.uFlood`.
 */
export function buryInSoil<
  TShader extends SoilShader,
  TRest extends readonly unknown[],
>(
  material: SoilMaterial<TShader, TRest>,
  uniforms: ReturnType<typeof xrayUniforms>,
  key: string
) {
  material.onBeforeCompile = (shader, ..._rest) => {
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
        "#include <color_fragment>\nvec4 buried = xraySoil(vXray);\ndiffuseColor.rgb = mix(diffuseColor.rgb, buried.rgb, buried.a);"
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 1.0, buried.a);"
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
vec3 buriedUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
vec3 buriedNormal = mix(normal, buriedUp, buried.a);
normal = dot(buriedNormal, buriedNormal) > 0.0001 ? normalize(buriedNormal) : buriedUp;`
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>\ntotalEmissiveRadiance = mix(totalEmissiveRadiance, buried.rgb * ${float(XRAY_GLOW)}, buried.a);`
      )
      .replace(
        "#include <lights_physical_fragment>",
        `#include <lights_physical_fragment>
#ifdef USE_CLEARCOAT
material.clearcoat *= 1.0 - buried.a;
#endif
#ifdef USE_SHEEN
material.sheenColor *= 1.0 - buried.a;
#endif`
      );
  };
  material.customProgramCacheKey = () => `paddy-buried-${key}`;
}
