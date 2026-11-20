import { activate } from "@/components/island/buffers";
import type { createGale } from "@/components/island/wind";
import { shedOf } from "@/lib/island/drift";
import type { Season } from "@/lib/island/season";
import type { Light, Weather } from "@/lib/island/sky";

/** Bytes in one float. */
const FLOAT = 4;

/** A uniform finder of a program. */
type Uniforms = (name: string) => WebGLUniformLocation | null;

/** A buffer of points, `size` numbers each, behind one vertex array. */
function pointsOf(gl: WebGL2RenderingContext, size: 3 | 4) {
  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();
  let count = 0;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, size, gl.FLOAT, false, size * FLOAT, 0);
  gl.bindVertexArray(null);
  return {
    count: () => count,
    draw() {
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.POINTS, 0, count);
    },
    release() {
      gl.deleteVertexArray(vao);
      gl.deleteBuffer(buffer);
    },
    write(next: Float32Array) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, next, gl.STATIC_DRAW);
      count = next.length / size;
    },
  };
}

/**
 * What drifts over the land by day, on the GPU (ADR 0047, D41): leaves
 * letting go of the crowns in the season's share and color, landing on the
 * ground or the water the window of land gives (`ground` hands it to the
 * leaf program), and butterflies over the meadow. Leaves fall in any dry
 * weather, day and night; butterflies fly only by day and never under rain or
 * snow.
 */
export function createDrift(
  gl: WebGL2RenderingContext,
  programs: readonly [leaves: WebGLProgram, butterflies: WebGLProgram],
  ground: (at: Uniforms) => void,
  season: Season
) {
  const [leafProgram, butterflyProgram] = programs;
  const crowns = pointsOf(gl, 4);
  const flowers = pointsOf(gl, 3);
  const shed = shedOf(season);
  const leafAt: Uniforms = (name) => gl.getUniformLocation(leafProgram, name);
  const butterflyAt: Uniforms = (name) =>
    gl.getUniformLocation(butterflyProgram, name);
  return {
    /** Draws the falling leaves and the butterflies at `time` seconds, lit as the scene is. */
    draw(
      camera: Float32Array,
      time: number,
      light: Light,
      sky: Weather,
      gale: ReturnType<typeof createGale>
    ) {
      const falling = sky === "rain" || sky === "storm" || sky === "snow";
      const lit = [
        Math.min(1, light.ambient[0] + light.sun[0] * 0.6),
        Math.min(1, light.ambient[1] + light.sun[1] * 0.6),
        Math.min(1, light.ambient[2] + light.sun[2] * 0.6),
      ] as const;
      if (crowns.count() > 0 && shed.share > 0 && !falling) {
        activate(gl, leafProgram);
        gl.uniformMatrix4fv(leafAt("uViewProjection"), false, camera);
        gl.uniform1f(leafAt("uTime"), time);
        gl.uniform1f(leafAt("uShare"), shed.share);
        gl.uniform3fv(leafAt("uLeaf"), shed.color);
        gl.uniform3fv(leafAt("uLight"), lit);
        gale.blow(leafAt, time, sky);
        ground(leafAt);
        crowns.draw();
      }
      if (flowers.count() > 0 && !falling && light.lamp[0] < 0.3) {
        activate(gl, butterflyProgram);
        gl.uniformMatrix4fv(butterflyAt("uViewProjection"), false, camera);
        gl.uniform1f(butterflyAt("uTime"), time);
        gl.uniform3fv(butterflyAt("uLight"), lit);
        flowers.draw();
      }
    },
    /**
     * Replaces where leaves fall from and where butterflies fly. `crowns` is
     * four numbers a crown: the place under the crown a leaf lets go from (x,
     * y, z in blocks) and the height of the ground under the tree.
     * `butterflies` is three numbers a butterfly: the place it settles (x, y,
     * z in blocks), about the height of a flower over the ground.
     */
    homes(next: {
      readonly butterflies: Float32Array;
      readonly crowns: Float32Array;
    }) {
      crowns.write(next.crowns);
      flowers.write(next.butterflies);
    },
    /** Lets the GPU go of the leaves and the butterflies. */
    release() {
      crowns.release();
      flowers.release();
    },
  };
}
