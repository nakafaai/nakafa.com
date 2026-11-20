import { Array as Arr, Option } from "effect";
import { unitOf } from "@/lib/island/noise";

/**
 * Makes a program the one the next draws use. WebGL names this `useProgram`,
 * which the hook rule would read as a React hook, so it is called through
 * `Reflect.apply`.
 */
export function activate(gl: WebGL2RenderingContext, program: WebGLProgram) {
  Reflect.apply(gl.useProgram, gl, [program]);
}

/** Compiles one program from its two shaders; none when the driver refuses them. */
export function programOf(
  gl: WebGL2RenderingContext,
  vertex: string,
  fragment: string
) {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type);
    if (shader === null) {
      return Option.none();
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) === true
    ? Option.some(program)
    : Option.none();
}

/** How many rain streaks or snowflakes fall around the camera. */
export const PARTICLES = 900;

/**
 * The seeds of the falling weather, two vertices each (the head and the tail
 * of a streak), uploaded once: where across the box it falls, and its phase.
 */
export function uploadWeather(gl: WebGL2RenderingContext) {
  const seeds = new Float32Array(PARTICLES * 2 * 4);
  Arr.forEach(
    Arr.makeBy(PARTICLES, (index) => index),
    (index) => {
      const seed = [
        unitOf(71, index, 1),
        unitOf(71, index, 2),
        unitOf(71, index, 3),
      ];
      seeds.set([...seed, 0, ...seed, 1], index * 8);
    }
  );
  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 16, 12);
  gl.bindVertexArray(null);
  return {
    release: () => {
      gl.deleteVertexArray(vao);
      gl.deleteBuffer(buffer);
    },
    vao,
  };
}
