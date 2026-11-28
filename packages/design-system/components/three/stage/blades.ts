import { chanceAt } from "@repo/design-system/components/three/field/noise";
import { WIND_SHADER } from "@repo/design-system/components/three/field/wind";
import type { Sward } from "@repo/design-system/components/three/stage/cover";
import { SWARD_SHADER } from "@repo/design-system/components/three/stage/cover";
import type { StageBudget } from "@repo/design-system/components/three/stage/tier";
import { Array as Arr } from "effect";
import type { IUniform, WebGLProgramParametersWithUniforms } from "three";

/**
 * The blades of a lawn near the camera: one tapered, curved blade drawn many
 * thousand times in a single call, each with its own place, height, turn,
 * lean, tint and width. A graphics card places and bends every blade, so
 * nothing is computed or allocated per frame in script.
 */

/** How tall a blade of mown grass stands at its tallest, in scene units. */
export const BLADE_HEIGHT = 0.11;

/**
 * How many blades a lawn draws on each tier, how far around the camera's
 * focus they stand, how many segments bend each blade, how wide a blade is
 * at its foot, and how fine the map of what presses the grass down is. A
 * weaker device draws fewer, broader blades over a smaller patch, so the
 * lawn stays as closed as on a strong one.
 */
export const BLADES: Record<
  StageBudget["tier"],
  {
    readonly count: number;
    readonly pressed: number;
    readonly radius: number;
    readonly segments: number;
    readonly width: number;
  }
> = {
  full: { count: 110_000, pressed: 512, radius: 6, segments: 4, width: 0.016 },
  light: { count: 44_000, pressed: 256, radius: 4.4, segments: 3, width: 0.02 },
  low: { count: 18_000, pressed: 256, radius: 3.2, segments: 2, width: 0.024 },
  plain: { count: 7000, pressed: 128, radius: 2.4, segments: 2, width: 0.03 },
};

/**
 * The numbers of one blade's mesh: `segments` levels of two vertices from
 * its foot up, narrowing as it rises, and one vertex at its tip. `shape`
 * holds, per vertex, how far it lies to the side of the blade's middle, from
 * -1 to 1, and how far along the blade it stands, from 0 to 1.
 */
export function bladeMesh(segments: number) {
  const shape = new Float32Array((segments * 2 + 1) * 2);
  for (let level = 0; level < segments; level += 1) {
    const along = level / segments;
    const half = 1 - 0.7 * along ** 1.4;
    shape.set([-half, along, half, along], level * 4);
  }
  shape.set([0, 1], segments * 4);
  const indices = Arr.flatMap(
    Arr.makeBy(segments, (level) => level * 2),
    (foot) =>
      foot === (segments - 1) * 2
        ? [foot, foot + 1, foot + 2]
        : [foot, foot + 1, foot + 2, foot + 2, foot + 1, foot + 3]
  );
  return { indices, shape };
}

/** How many blades grow from one tuft, and how far from its middle, in scene units. */
const TUFT = { blades: 5, spread: 0.035 } as const;

/**
 * Scatters `count` blades over a square of side `span`, the same on every
 * device. Three blades in five grow in tufts, as grass does, and the rest
 * stand alone between them. `roots` holds, per blade, its place across and
 * along the square, how tall it grows, from 0.45 to 1, and which way it
 * faces, in radians. `traits` holds how far it leans over, its tint and its
 * chance of standing where the grass thins, each from 0 to 1, and how wide
 * it is, from 0.7 to 1.3.
 */
export function scatterBlades(count: number, span: number, seed: number) {
  const roots = new Float32Array(count * 4);
  const traits = new Float32Array(count * 4);
  for (let blade = 0; blade < count; blade += 1) {
    const tufted = chanceAt(blade, 1, seed) < 0.6;
    const home = tufted ? Math.floor(blade / TUFT.blades) : blade;
    const away = tufted ? TUFT.spread * Math.sqrt(chanceAt(blade, 2, seed)) : 0;
    const around = 2 * Math.PI * chanceAt(blade, 3, seed);
    const x = chanceAt(home, 4, seed) * span + away * Math.cos(around);
    const z = chanceAt(home, 5, seed) * span + away * Math.sin(around);
    roots.set(
      [
        ((x % span) + span) % span,
        ((z % span) + span) % span,
        0.45 + 0.55 * chanceAt(blade, 6, seed) ** 1.6,
        2 * Math.PI * chanceAt(blade, 7, seed),
      ],
      blade * 4
    );
    traits.set(
      [
        0.15 + 0.75 * chanceAt(blade, 8, seed) ** 2,
        chanceAt(blade, 9, seed),
        chanceAt(blade, 10, seed),
        0.7 + 0.6 * chanceAt(blade, 11, seed),
      ],
      blade * 4
    );
  }
  return { roots, traits };
}

/** How much nearer the camera than the far side of its patch the blades start, in radii. */
const LEAD = 0.8;

/** The shallowest a view may look down before it counts as level, in radians. */
const LEVEL = 0.02;

/**
 * Finds where on the ground the blades of a lawn should stand thickest for
 * one view, and writes it into `out` as x then y for the ground's x and z:
 * where the camera looks, but no farther than a patch that starts at the
 * bottom of the frame, where the ground is nearest and largest. The place
 * is held to a grid of `grid`, so what is drawn around it does not swim as
 * the camera moves.
 *
 * @param out - Where the place is written
 * @param eye - The camera's place
 * @param gaze - The unit direction the camera looks in
 * @param halfFov - Half the camera's vertical field of view, in radians
 * @param floor - The height of the ground
 * @param radius - How far around the place the blades stand
 * @param grid - The grid the place is held to
 */
export function focusOn(
  out: { x: number; y: number },
  eye: readonly [x: number, y: number, z: number],
  gaze: readonly [x: number, y: number, z: number],
  halfFov: number,
  floor: number,
  radius: number,
  grid: number
) {
  const height = Math.max(0.05, eye[1] - floor);
  const level = Math.hypot(gaze[0], gaze[2]);
  const pitch = Math.atan2(-gaze[1], level);
  const lowest = Math.min(Math.PI / 2, Math.max(LEVEL, pitch + halfFov));
  const nearest = height / Math.tan(lowest);
  const looked =
    pitch > LEVEL ? height / Math.tan(pitch) : Number.POSITIVE_INFINITY;
  const along = Math.min(looked, nearest + LEAD * radius);
  const step = level > 1e-6 ? along / level : 0;
  out.x = Math.round((eye[0] + gaze[0] * step) / grid) * grid;
  out.y = Math.round((eye[2] + gaze[2] * step) / grid) * grid;
  return out;
}

/** The parts of a material's program that the blades rewrite before it compiles. */
type Program = Pick<
  WebGLProgramParametersWithUniforms,
  "fragmentShader" | "uniforms" | "vertexShader"
>;

/** How far the hardest gust lays a blade over, and how far it trembles, in blade heights. */
const GIVE = { gust: 0.55, tremble: 0.07 } as const;

/** What the blades of a lawn read beside what they share with its ground. */
export interface Growth extends Sward {
  /** How tall a blade stands at its tallest, in scene units. */
  readonly uBlade: IUniform<number>;
  /** How much of the view one pixel spans at a distance of one, in scene units. */
  readonly uPixel: IUniform<number>;
  /** The time the wind is read at, in seconds. */
  readonly uTime: IUniform<number>;
  /** How wide a blade is at its foot, in scene units. */
  readonly uWidth: IUniform<number>;
}

/**
 * Rewrites the program of a standard material, in place, so it draws the
 * blades of a lawn. Each blade stands at its own root, in the copy of the
 * scattered square nearest the focus, so the patch follows the view with no
 * end to see. It grows as tall as the cover is thick and tall there, sinks
 * to nothing toward the rim of the patch, where the land starts to roll and
 * under whatever lies on the ground, curves over by its own lean, and
 * bends downwind with the shared wind. A blade too far to be a pixel wide
 * is drawn a pixel wide, so a distant lawn does not shimmer. Its tone is
 * the cover's tone, dark at the foot where the lawn shades itself.
 *
 * @param program - The program of a standard material
 * @param growth - The lawn's shared values and the blades' own
 */
export function layBlades(program: Program, growth: Growth) {
  program.uniforms.uCover = growth.uCover;
  program.uniforms.uFlat = growth.uFlat;
  program.uniforms.uFocus = growth.uFocus;
  program.uniforms.uPressed = growth.uPressed;
  program.uniforms.uRadius = growth.uRadius;
  program.uniforms.uBlade = growth.uBlade;
  program.uniforms.uPixel = growth.uPixel;
  program.uniforms.uTime = growth.uTime;
  program.uniforms.uWidth = growth.uWidth;
  program.vertexShader = program.vertexShader
    .replace(
      "#include <common>",
      `#include <common>
attribute vec2 aShape;
attribute vec4 aRoot;
attribute vec4 aTrait;
uniform float uTime;
uniform float uPixel;
uniform float uBlade;
uniform float uWidth;
varying vec3 vBladeTone;
varying float vBladeAlong;
${SWARD_SHADER}
${WIND_SHADER}`
    )
    .replace(
      "#include <beginnormal_vertex>",
      `float bladeSpan = 2.0 * uRadius;
vec2 bladeHome = aRoot.xy + bladeSpan * floor((uFocus - aRoot.xy) / bladeSpan + 0.5);
vec4 bladeCover = swardCover(bladeHome);
float bladePressed = texture2D(uPressed, (bladeHome - uFocus) / bladeSpan + 0.5).r;
float bladeStands = smoothstep(0.0, 0.3, 1.25 * bladeCover.r - aTrait.z);
float bladeTall = uBlade * aRoot.z * (0.4 + 0.6 * bladeCover.a) * bladeStands * swardNear(bladeHome) * (1.0 - bladePressed);
float bladeWind = windAt(bladeHome, uTime);
vec2 bladeFace = vec2(cos(aRoot.w), sin(aRoot.w));
vec2 bladeLean = bladeFace * aTrait.x + WIND_HEADING * (${GIVE.gust.toFixed(4)} * bladeWind + ${GIVE.tremble.toFixed(4)} * bladeWind * sin(uTime * 5.3 + 40.0 * aTrait.y));
float bladeOver = min(1.0, dot(bladeLean, bladeLean) * aShape.y * aShape.y);
vec3 bladeAt = vec3(bladeHome.x, 0.0, bladeHome.y) + bladeTall * vec3(bladeLean.x * aShape.y * aShape.y, aShape.y * (1.0 - 0.42 * bladeOver), bladeLean.y * aShape.y * aShape.y);
float bladeWide = max(uWidth * aTrait.w, 1.3 * uPixel * distance(cameraPosition, (modelMatrix * vec4(bladeAt, 1.0)).xyz)) * step(0.0005, bladeTall);
bladeAt += vec3(-bladeFace.y, 0.0, bladeFace.x) * (0.5 * aShape.x * bladeWide);
vec3 objectNormal = normalize(vec3(0.45 * bladeFace.x, 1.0 + aShape.y * aTrait.x, 0.45 * bladeFace.y));
vBladeTone = swardTone(bladeCover, 0.5 * (aTrait.y - 0.5)) * (0.84 + 0.36 * aTrait.y);
vBladeAlong = aShape.y;`
    )
    .replace("#include <begin_vertex>", "vec3 transformed = bladeAt;");
  program.fragmentShader = program.fragmentShader
    .replace(
      "#include <common>",
      "#include <common>\nvarying vec3 vBladeTone;\nvarying float vBladeAlong;"
    )
    .replace(
      "#include <color_fragment>",
      "#include <color_fragment>\ndiffuseColor.rgb = vBladeTone * mix(0.58, 1.0, vBladeAlong);"
    )
    .replace(
      "#include <normal_fragment_begin>",
      "#include <normal_fragment_begin>\nnormal = normalize(vNormal);"
    );
}
