import { Array as Arr, Option } from "effect";
import { activate, programOf } from "@/components/island/buffers";
import type { createFrame } from "@/components/island/frame";
import { eyeOf, type Orbit } from "@/lib/island/camera";
import { CLIP, invert } from "@/lib/island/matrix";
import { EDGE_FRAGMENT, EDGE_VERTEX } from "@/lib/island/shaders";
import { SEA_LEVEL } from "@/lib/island/world";

/**
 * The edge pass (ADR 0047, D20): it paints the edged frame from the scene's
 * colors, faces and depth, a dark outline on the near side of every
 * silhouette and a light line where a top meets a side. None when the driver
 * refuses its program.
 */
export function createEdges(gl: WebGL2RenderingContext) {
  return Option.map(programOf(gl, EDGE_VERTEX, EDGE_FRAGMENT), (program) => {
    const at = (name: string) => gl.getUniformLocation(program, name);
    return {
      /** Paints `target`'s edged frame for a scene seen from `orbit` through `camera`. */
      draw(
        target: ReturnType<typeof createFrame>,
        orbit: Orbit,
        camera: Float32Array
      ) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.final);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
        activate(gl, program);
        Arr.forEach(
          [target.color, target.surface, target.depth],
          (texture, unit) => {
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, texture);
          }
        );
        gl.uniform1i(at("uColor"), 0);
        gl.uniform1i(at("uSurface"), 1);
        gl.uniform1i(at("uDepth"), 2);
        gl.uniform2f(at("uTexel"), 1 / target.width, 1 / target.height);
        gl.uniform2f(at("uClip"), CLIP.near, CLIP.far);
        gl.uniformMatrix4fv(at("uInverse"), false, invert(camera));
        gl.uniform1f(at("uSea"), SEA_LEVEL - 0.2);
        const eye = eyeOf(orbit);
        const ahead = [
          eye[0] - orbit.target[0],
          eye[1] - orbit.target[1],
          eye[2] - orbit.target[2],
        ] as const;
        const length = Math.hypot(ahead[0], ahead[1], ahead[2]);
        gl.uniform3f(
          at("uAhead"),
          ahead[0] / length,
          ahead[1] / length,
          ahead[2] / length
        );
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.activeTexture(gl.TEXTURE0);
      },
      /** Lets the GPU go of the edge program. */
      release() {
        gl.deleteProgram(program);
      },
    };
  });
}
