import {
  cellsAt,
  fractalAt,
  warpedAt,
} from "@repo/design-system/components/three/field/noise";
import type {
  IUniform,
  Texture,
  Vector2,
  WebGLProgramParametersWithUniforms,
} from "three";

/**
 * What grows on a lawn, place by place: how thick the grass stands, how dry
 * it is, where clover has spread and how tall it has grown. The blades near
 * the camera and the shaded ground far from it both read this one field, so
 * a bare patch, a dry patch and a clump of clover lie in the same place in
 * both, and no line shows where the blades stop.
 */

/** How far one tile of the cover reaches before it repeats, in scene units. */
export const COVER_SPAN = 9.6;

/** How many times wider the second, broad reading of the cover lies. */
const BROAD = 4.7;

/** One tone as its red, green and blue, each from 0 to 255. */
type Tone = readonly [red: number, green: number, blue: number];

/**
 * The tones of a lawn: grass in full growth, grass dried to straw, the
 * darker blue green of clover, and the soil that shows where nothing grows.
 */
export const LAWN_TONES = {
  clover: [72, 128, 62],
  dry: [170, 160, 88],
  lush: [98, 146, 56],
  soil: [122, 100, 74],
} as const satisfies Record<string, Tone>;

/** How bright grass seen from far above reads, and the thatch between the blades near the camera. */
const FAR_GAIN = 1.22;
const UNDER_GAIN = 0.92;

/** A number held between 0 and 1. */
function held(value: number) {
  return Math.min(1, Math.max(0, value));
}

/**
 * Paints the cover of a lawn as one square image of `size` pixels that
 * tiles without a seam, four bytes a pixel. Red is how thick the grass
 * stands, from bare soil at 0, in worn patches with ragged edges, to full
 * growth at 255. Green is how dry it is. Blue is clover, in round patches.
 * Alpha is how tall the grass has grown, in soft tufts.
 */
export function paintCover(size: number) {
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let pixel = 0; pixel < size * size; pixel += 1) {
    const x = (pixel % size) / size;
    const y = Math.floor(pixel / size) / size;
    const worn = warpedAt(x, y, 4, 4, 401, 0.35);
    const ragged = fractalAt(x, y, 34, 34, 409, 2);
    const bare = held((0.35 - worn + 0.1 * (ragged - 0.5)) / 0.1);
    const thin = 0.72 + 0.28 * fractalAt(x, y, 13, 13, 419, 3);
    const dry = held((fractalAt(x, y, 5, 5, 421, 3) - 0.48) * 3.4);
    const leaves = cellsAt(x, y, 7, 7, 431);
    const clover =
      leaves.owner < 0.3 ? held(1.6 - leaves.nearest * 3.4) * (1 - bare) : 0;
    const tall = 0.35 + 0.65 * fractalAt(x, y, 11, 11, 433, 3);
    pixels.set(
      [(1 - bare) * thin * 255, dry * 255, clover * 255, tall * 255],
      pixel * 4
    );
  }
  return pixels;
}

/** A tone as the linear red, green and blue a shader lights, from its sRGB bytes. */
export function linearTone([red, green, blue]: Tone) {
  const linear = (byte: number) => {
    const value = byte / 255;
    return value <= 0.040_45 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return [linear(red), linear(green), linear(blue)] as const;
}

/**
 * What the ground and the blades of one lawn share: the painted cover,
 * where the blades stand thickest (around `focus`, out to `radius`, and no
 * farther from the lab than the flat of the land, `flat`), and the map of
 * what lies on the ground and presses the grass down.
 */
export interface Sward {
  readonly uCover: IUniform<Texture>;
  readonly uFlat: IUniform<number>;
  readonly uFocus: IUniform<Vector2>;
  readonly uPressed: IUniform<Texture>;
  readonly uRadius: IUniform<number>;
}

/**
 * The cover as a shader reads it at a place on the ground: `swardAt` answers
 * the lawn's tone there in its first three numbers and how thick the grass
 * stands in its fourth, and `swardNear` how fully blades stand there.
 */
export const SWARD_SHADER = `
uniform sampler2D uCover;
uniform sampler2D uPressed;
uniform vec2 uFocus;
uniform float uRadius;
uniform float uFlat;
const vec3 SWARD_LUSH = vec3(${linearTone(LAWN_TONES.lush).join(", ")});
const vec3 SWARD_DRY = vec3(${linearTone(LAWN_TONES.dry).join(", ")});
const vec3 SWARD_CLOVER = vec3(${linearTone(LAWN_TONES.clover).join(", ")});
const vec3 SWARD_SOIL = vec3(${linearTone(LAWN_TONES.soil).join(", ")});
vec4 swardCover(vec2 place) {
  vec4 fine = texture2D(uCover, place / ${COVER_SPAN.toFixed(4)});
  vec4 broad = texture2D(uCover, place.yx / ${(COVER_SPAN * BROAD).toFixed(4)} + 0.37);
  return vec4(
    fine.r * (0.72 + 0.28 * broad.r),
    clamp(0.55 * fine.g + 0.75 * broad.g - 0.2, 0.0, 1.0),
    fine.b,
    fine.a * (0.7 + 0.3 * broad.a)
  );
}
vec3 swardTone(vec4 cover, float tint) {
  vec3 tone = mix(SWARD_LUSH, SWARD_DRY, clamp(cover.g + tint, 0.0, 1.0));
  return mix(tone, SWARD_CLOVER, 0.4 * cover.b);
}
float swardNear(vec2 place) {
  float near = 1.0 - smoothstep(0.45 * uRadius, uRadius, distance(place, uFocus));
  return near * (1.0 - smoothstep(0.8 * uFlat, uFlat, length(place)));
}
`;

/** The parts of a material's program that a lawn rewrites before it compiles. */
type Program = Pick<
  WebGLProgramParametersWithUniforms,
  "fragmentShader" | "uniforms"
>;

/**
 * Rewrites the program of the ground of a lawn, in place, after `layGround`
 * has laid it, whose place of each pixel in the world it reads. The ground
 * takes the tone of the grass that stands on it: the mean tone of the
 * blades where they are too far to draw, the dark thatch between them where
 * they stand, and bare soil, a little glossier where it is packed, wherever
 * the cover is worn through.
 */
export function layCover(program: Program, sward: Sward) {
  program.uniforms.uCover = sward.uCover;
  program.uniforms.uFlat = sward.uFlat;
  program.uniforms.uFocus = sward.uFocus;
  program.uniforms.uPressed = sward.uPressed;
  program.uniforms.uRadius = sward.uRadius;
  program.fragmentShader = program.fragmentShader
    .replace("#include <common>", `#include <common>\n${SWARD_SHADER}`)
    .replace(
      "#include <roughnessmap_fragment>",
      `#include <roughnessmap_fragment>
vec4 swardHere = swardCover(vHorizonWorldPos.xz);
float swardBlades = swardNear(vHorizonWorldPos.xz) * (1.0 - texture2D(uPressed, (vHorizonWorldPos.xz - uFocus) / (2.0 * uRadius) + 0.5).r);
float swardGrown = 0.12 + 0.88 * smoothstep(0.04, 0.55, swardHere.r);
vec3 swardGrass = swardTone(swardHere, 0.0) * mix(${FAR_GAIN.toFixed(4)}, ${UNDER_GAIN.toFixed(4)}, swardBlades);
diffuseColor.rgb *= mix(SWARD_SOIL, swardGrass, swardGrown);
roughnessFactor = mix(0.82 * roughnessFactor, roughnessFactor, swardGrown);`
    );
}
