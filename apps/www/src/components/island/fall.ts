import { Option } from "effect";
import {
  activate,
  PARTICLES,
  uploadWeather,
} from "@/components/island/buffers";
import type { createGale } from "@/components/island/wind";
import type { Orbit } from "@/lib/island/camera";
import { createCover, stepCover } from "@/lib/island/cover";
import type { Weather } from "@/lib/island/sky";
import { fallOf } from "@/lib/island/sky";

/** The side of the square of sky the weather falls through round the camera's target, near in. */
const AREA = 56;

/** A uniform finder of a program. */
type Uniforms = (name: string) => WebGLUniformLocation | null;

/**
 * The weather on the GPU (ADR 0047, D33; ADR 0050, W10): what falls and where
 * it stops, and what it leaves on the ground. `ground` hands the weather
 * program the window of land, where every drop reads the ground or the water
 * it stops on. It holds the particles that fall and how wet and how snowed
 * the land is, which it moves on as the world is drawn and hands to the
 * programs that draw the land.
 */
export function createFall(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  ground: (at: Uniforms) => void
) {
  const particles = uploadWeather(gl);
  const cover = createCover();
  let stepped = Option.none<number>();
  const locate: Uniforms = (name) => gl.getUniformLocation(program, name);
  return {
    /** Hands a program that draws the land how wet the ground is and how much snow lies on it. */
    cover(place: Uniforms) {
      gl.uniform1f(place("uWet"), cover.wet);
      gl.uniform1f(place("uSnow"), cover.snow);
    },
    /**
     * Draws what falls under a weather, carried by the wind, then what the
     * drops that just landed leave: droplets thrown up from the ground, rings
     * on water. Snow only falls; it lies as the cover.
     */
    draw(
      orbit: Orbit,
      time: number,
      camera: Float32Array,
      sky: Weather,
      gale: ReturnType<typeof createGale>
    ) {
      Option.map(fallOf(sky), (fall) => {
        activate(gl, program);
        gl.uniformMatrix4fv(locate("uViewProjection"), false, camera);
        gl.uniform3fv(locate("uTarget"), orbit.target);
        gl.uniform1f(locate("uTime"), time);
        gl.uniform1f(locate("uSpeed"), fall.speed);
        gl.uniform1f(locate("uLength"), fall.length);
        gl.uniform1f(locate("uSway"), fall.sway);
        // The weather covers all the camera sees: wider and taller as it stands back, with more drops to keep it as dense.
        const area = Math.max(AREA, orbit.distance * 1.6);
        gl.uniform1f(locate("uArea"), area);
        gl.uniform1f(locate("uTop"), Math.max(16, area * 0.3));
        gl.uniform4fv(locate("uColor"), fall.color);
        gale.blow(locate, time, sky);
        ground(locate);
        gl.bindVertexArray(particles.vao);
        const count =
          Math.min(PARTICLES, Math.round(fall.count * (area / AREA) ** 2)) * 2;
        gl.uniform1f(locate("uSplash"), 0);
        gl.drawArrays(fall.flakes ? gl.POINTS : gl.LINES, 0, count);
        if (!fall.flakes) {
          gl.uniform1f(locate("uSplash"), 1);
          gl.drawArrays(gl.POINTS, 0, count);
        }
      });
    },
    /** Lets the GPU go of the particles. */
    release() {
      particles.release();
    },
    /** Moves how wet and how snowed the land is on to `time` seconds under a weather. */
    step(time: number, sky: Weather) {
      stepCover(cover, sky, time - Option.getOrElse(stepped, () => time));
      stepped = Option.some(time);
    },
  };
}
