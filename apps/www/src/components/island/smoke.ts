import { activate } from "@/components/island/buffers";
import type { createGale } from "@/components/island/wind";
import type { Light, Weather } from "@/lib/island/sky";

/** Puffs drawn for each chimney, the smoke program's own count. */
const PUFFS = 12;

/** Bytes in one float. */
const FLOAT = 4;

/**
 * The chimneys' and the fires' smoke on the GPU (ADR 0047, D33): where each
 * one stands about the camera, set again whenever the land there changes,
 * and its puffs drawn over the scene, carried by the wind and lit like the
 * air around them.
 */
export function createSmoke(gl: WebGL2RenderingContext, program: WebGLProgram) {
  const vao = gl.createVertexArray();
  const tops = gl.createBuffer();
  let count = 0;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, tops);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 3 * FLOAT, 0);
  gl.vertexAttribDivisor(0, 1);
  gl.bindVertexArray(null);
  const locate = (name: string) => gl.getUniformLocation(program, name);
  return {
    /** Replaces where smoke rises from, three numbers a chimney: the place the smoke leaves it, x, y, z in blocks. */
    chimneys(next: Float32Array) {
      gl.bindBuffer(gl.ARRAY_BUFFER, tops);
      gl.bufferData(gl.ARRAY_BUFFER, next, gl.STATIC_DRAW);
      count = next.length / 3;
    },
    /** Draws every chimney's puffs at `time` seconds, pale in the sun and grey in the shade. */
    draw(
      camera: Float32Array,
      time: number,
      light: Light,
      sky: Weather,
      gale: ReturnType<typeof createGale>
    ) {
      if (count === 0) {
        return;
      }
      activate(gl, program);
      gl.uniformMatrix4fv(locate("uViewProjection"), false, camera);
      gale.blow(locate, time, sky);
      // A warm grey a little darker than the light around it, so a puff reads against a bright sky and a pale wall alike.
      gl.uniform3f(
        locate("uTint"),
        Math.min(0.86, 0.18 + light.ambient[0] + light.sun[0] * 0.45),
        Math.min(0.85, 0.17 + light.ambient[1] + light.sun[1] * 0.45),
        Math.min(0.86, 0.19 + light.ambient[2] + light.sun[2] * 0.45)
      );
      gl.bindVertexArray(vao);
      gl.drawArraysInstanced(gl.POINTS, 0, PUFFS, count);
    },
    /** Lets the GPU go of the chimneys. */
    release() {
      gl.deleteVertexArray(vao);
      gl.deleteBuffer(tops);
    },
  };
}
