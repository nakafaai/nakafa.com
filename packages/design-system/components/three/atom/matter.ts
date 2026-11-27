import { Array as Arr } from "effect";
import type { WebGLProgramParametersWithUniforms } from "three";

/** The part of a material's program a nucleon rewrites before it compiles. */
type Program = Pick<WebGLProgramParametersWithUniforms, "fragmentShader">;

/**
 * How strongly a nucleon shines by itself, as shares of its own colour: the
 * grainy glow from within, the light along its rim, and how tightly that
 * light keeps to the rim.
 */
const WITHIN = 0.16;
const RIM = 0.9;
const RIM_FALL = 2.6;

/** The share of the stage's light a nucleon's body takes, so its colour never burns out flat, and the share of white in its rim light. */
const BODY = 0.62;
const PALE = 0.35;

/** The name the renderer caches a nucleon's rewritten program under. */
export const NUCLEON_PROGRAM = "atom-nucleon";

/**
 * Rewrites the program of a nucleon's material, in place, so it reads as
 * matter and energy and not as a painted ball: what the material emits
 * becomes a glow in the nucleon's own colour, grainy where its surface
 * is grainy, plus a soft, paler light along its rim where the surface
 * turns away from the eye, and the body takes less of the stage's light so
 * its colour keeps its shading. Nothing in it is a mirror highlight.
 */
export function lightNucleon(program: Program) {
  program.fragmentShader = program.fragmentShader.replace(
    "#include <emissivemap_fragment>",
    Arr.join(
      [
        "#include <emissivemap_fragment>",
        `float nucleonRim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), ${RIM_FALL.toFixed(2)});`,
        `totalEmissiveRadiance = diffuseColor.rgb * totalEmissiveRadiance * ${WITHIN.toFixed(2)} + mix(diffuseColor.rgb, vec3(1.0), ${PALE.toFixed(2)}) * nucleonRim * ${RIM.toFixed(2)};`,
        `diffuseColor.rgb *= ${BODY.toFixed(2)};`,
      ],
      "\n"
    )
  );
}

/** The size nucleon `index` is drawn at, as a share of its packed size: most a little larger, so neighbours press into each other and no two are quite alike. */
export function swellOf(index: number) {
  return 0.98 + 0.1 * Math.sin(index * 2.399_963) ** 2;
}

/**
 * How large and how bright the glow about a nucleus is at `time` seconds,
 * as shares of its rest size and brightness: a slow, shallow breath.
 */
export function breathAt(time: number) {
  const breath = Math.sin(time * 1.3);
  return { glow: 1 + 0.16 * breath, size: 1 + 0.05 * breath };
}
