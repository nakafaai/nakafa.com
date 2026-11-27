import type { Texture, WebGLProgramParametersWithUniforms } from "three";

/** The parts of a material's program that a ground rewrites before it compiles. */
type Program = Pick<
  WebGLProgramParametersWithUniforms,
  "fragmentShader" | "uniforms" | "vertexShader"
>;

/** The colour of a whole ground at a scale far broader than its tiles. */
interface Sweep {
  /** How far one sweep reaches across and along before it repeats, in scene units. */
  readonly span: readonly [across: number, along: number];
  readonly texture: Texture;
}

/** What a ground adds to the program of the material it is drawn with. */
export interface Lay {
  /** Where the surface starts to dissolve, from the scene's origin. */
  readonly inner: number;
  /** Where the surface has dissolved completely, from the scene's origin. */
  readonly outer: number;
  /** The broad colour laid over the tiles, for a ground that has one. */
  readonly sweep?: Sweep | undefined;
}

/**
 * Rewrites the program of a material that lies on a stage's ground, in
 * place. The surface dissolves to nothing between `inner` and `outer`
 * around the scene's origin, along a quintic curve with no crease in slope
 * or curvature, so no edge ever shows against the backdrop. A ground with a
 * sweep also takes its broad colour from the place of each pixel in the
 * world, so that colour lies still under every mesh and texture laid on it.
 */
export function layGround(program: Program, { inner, outer, sweep }: Lay) {
  program.uniforms.uHorizonInner = { value: inner };
  program.uniforms.uHorizonOuter = { value: outer };
  program.vertexShader = program.vertexShader
    .replace(
      "#include <common>",
      "#include <common>\nvarying vec3 vHorizonWorldPos;"
    )
    .replace(
      "#include <worldpos_vertex>",
      "#include <worldpos_vertex>\nvHorizonWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;"
    );
  program.fragmentShader = program.fragmentShader
    .replace(
      "#include <common>",
      "#include <common>\nuniform float uHorizonInner;\nuniform float uHorizonOuter;\nvarying vec3 vHorizonWorldPos;"
    )
    .replace(
      "#include <dithering_fragment>",
      `float horizonT = clamp((length(vHorizonWorldPos.xz) - uHorizonInner) / max(0.0001, uHorizonOuter - uHorizonInner), 0.0, 1.0);
float horizonSmooth = 1.0 - horizonT * horizonT * horizonT * (horizonT * (horizonT * 6.0 - 15.0) + 10.0);
gl_FragColor.a *= horizonSmooth;
if (gl_FragColor.a <= 0.002) discard;
#include <dithering_fragment>`
    );
  if (sweep === undefined) {
    return;
  }
  program.uniforms.uSweep = { value: sweep.texture };
  program.uniforms.uSweepScale = {
    value: [1 / sweep.span[0], 1 / sweep.span[1]],
  };
  program.fragmentShader = program.fragmentShader
    .replace(
      "#include <common>",
      "#include <common>\nuniform sampler2D uSweep;\nuniform vec2 uSweepScale;"
    )
    .replace(
      "#include <map_fragment>",
      "#include <map_fragment>\ndiffuseColor.rgb *= texture2D(uSweep, vHorizonWorldPos.xz * uSweepScale).rgb;"
    );
}

/**
 * Names the program `layGround` makes for one lay, so a material takes a new
 * program, and with it new radii and a new sweep, whenever its lay changes.
 */
export function layKey({ inner, outer, sweep }: Lay) {
  const swept =
    sweep === undefined
      ? "plain"
      : `${sweep.texture.id}-${sweep.span[0].toFixed(3)}-${sweep.span[1].toFixed(3)}`;
  return `ground-${inner.toFixed(2)}-${outer.toFixed(2)}-${swept}`;
}
