import { createBodies } from "@/components/island/bodies";
import { activate, uploadMoving } from "@/components/island/buffers";

/** The learner's own fox, the one body seen through what stands in front of it. */
const FOX = { _tag: "body", kind: "fox" } as const;

/** A uniform finder of a program. */
type Uniforms = (name: string) => WebGLUniformLocation | null;

/**
 * The island's life on the GPU (ADR 0047, D21): every true 3D body, one mesh
 * a model drawn with the body program, and the flat quads of Nina and the
 * float, drawn with the chunk program among the blocks.
 */
export function createLife(gl: WebGL2RenderingContext, program: WebGLProgram) {
  const bodies = createBodies(gl);
  const flat = uploadMoving(gl, 64);
  const uniform: Uniforms = (name) => gl.getUniformLocation(program, name);

  /** Puts the body program in use with the view `camera` it draws from and the clock and the wind `wind` sets (D21). */
  const start = (
    camera: Float32Array,
    time: number,
    wind: (at: Uniforms) => void
  ) => {
    activate(gl, program);
    gl.uniformMatrix4fv(uniform("uViewProjection"), false, camera);
    gl.uniform1f(uniform("uTime"), time);
    wind(uniform);
  };

  return {
    /** Replaces the flat quads of Nina and the float. */
    quads(next: Parameters<typeof flat.write>[0]) {
      flat.write(next);
    },
    /** Replaces where every true 3D body stands this frame (D21). */
    bodies(next: Parameters<typeof bodies.write>[0]) {
      bodies.write(next);
    },
    /** Draws the flat quads with the chunk program already in use. */
    flat() {
      gl.bindVertexArray(flat.vao);
      gl.drawElements(gl.TRIANGLES, flat.count(), gl.UNSIGNED_INT, 0);
    },
    /** Draws every body into the sun's shadow map from its view `sun` (D43). */
    cast(sun: Float32Array, time: number, wind: (at: Uniforms) => void) {
      start(sun, time, wind);
      bodies.draw();
    },
    /**
     * Draws every body from `camera`, lit by `lit` in the blocks' toon bands
     * and edged like them (D21, D43). The learner's fox shows through what
     * stands in front of it as a dithered outline of itself, then draws over
     * that wherever it is in sight (D38).
     */
    draw(
      camera: Float32Array,
      time: number,
      wind: (at: Uniforms) => void,
      lit: (at: Uniforms) => void
    ) {
      start(camera, time, wind);
      lit(uniform);
      gl.enable(gl.CULL_FACE);
      bodies.draw(FOX);
      gl.depthMask(false);
      gl.depthFunc(gl.GREATER);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
      gl.uniform1f(uniform("uSeen"), 1);
      bodies.drawModel(FOX);
      gl.uniform1f(uniform("uSeen"), 0);
      gl.depthFunc(gl.LESS);
      gl.depthMask(true);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      bodies.drawModel(FOX);
      gl.disable(gl.CULL_FACE);
    },
    /** Lets the GPU go of every body and quad. */
    release() {
      bodies.release();
      flat.release();
    },
  };
}
