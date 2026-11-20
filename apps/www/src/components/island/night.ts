import { activate } from "@/components/island/buffers";
import type { Light, Weather } from "@/lib/island/sky";

/** Bytes in one float. */
const FLOAT = 4;

/**
 * The fireflies on the GPU (ADR 0047, D36): their homes about the camera,
 * set again whenever the land there changes, drawn after dusk over the
 * scene, and never in rain or snow.
 */
export function createNight(gl: WebGL2RenderingContext, program: WebGLProgram) {
  const vao = gl.createVertexArray();
  const homes = gl.createBuffer();
  let count = 0;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, homes);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 3 * FLOAT, 0);
  gl.bindVertexArray(null);
  const locate = (name: string) => gl.getUniformLocation(program, name);
  return {
    /** Draws every firefly at `time` seconds, as bright as the night is dark, and none in a falling sky. */
    draw(camera: Float32Array, time: number, light: Light, sky: Weather) {
      const falling = sky === "rain" || sky === "storm" || sky === "snow";
      if (count === 0 || falling || light.lamp[0] < 0.3) {
        return;
      }
      activate(gl, program);
      gl.uniformMatrix4fv(locate("uViewProjection"), false, camera);
      gl.uniform1f(locate("uTime"), time);
      gl.uniform1f(locate("uNight"), Math.min(1, (light.lamp[0] - 0.3) / 0.5));
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.POINTS, 0, count);
    },
    /** Replaces where the fireflies live, three numbers a firefly: the middle of its loop, x, y, z in blocks, about a block over the ground. */
    homes(next: Float32Array) {
      gl.bindBuffer(gl.ARRAY_BUFFER, homes);
      gl.bufferData(gl.ARRAY_BUFFER, next, gl.STATIC_DRAW);
      count = next.length / 3;
    },
    /** Lets the GPU go of the fireflies. */
    release() {
      gl.deleteVertexArray(vao);
      gl.deleteBuffer(homes);
    },
  };
}
