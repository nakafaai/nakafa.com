import { Option } from "effect";
import { activate, programOf } from "@/components/island/buffers";
import { createFall } from "@/components/island/fall";
import { createNight } from "@/components/island/night";
import { createSmoke } from "@/components/island/smoke";
import type { createGale } from "@/components/island/wind";
import {
  BITS,
  BURSTS,
  DUST_FRAGMENT,
  DUST_VERTEX,
  FIREFLY_FRAGMENT,
  FIREFLY_VERTEX,
  SMOKE_FRAGMENT,
  SMOKE_VERTEX,
  WEATHER_FRAGMENT,
  WEATHER_VERTEX,
} from "@/lib/island/air";
import type { Orbit } from "@/lib/island/camera";
import { dustOf } from "@/lib/island/dust";
import type { Light, Weather } from "@/lib/island/sky";

/**
 * What moves in the air over the island, on the GPU (ADR 0047, D33 and D36):
 * the falling weather and what it leaves on the ground, the chimneys' smoke,
 * and the fireflies after dusk. The painter steps it, hands it what the
 * blocks decide, and draws it over the scene; none when the browser refuses
 * one of its programs.
 */
export function createAir(
  gl: WebGL2RenderingContext,
  gale: ReturnType<typeof createGale>,
  pixels: Uint8ClampedArray
) {
  return Option.map(
    Option.all([
      programOf(gl, WEATHER_VERTEX, WEATHER_FRAGMENT),
      programOf(gl, SMOKE_VERTEX, SMOKE_FRAGMENT),
      programOf(gl, FIREFLY_VERTEX, FIREFLY_FRAGMENT),
      programOf(gl, DUST_VERTEX, DUST_FRAGMENT),
    ]),
    ([weatherProgram, smokeProgram, fireflyProgram, dustProgram]) => {
      const fall = createFall(gl, weatherProgram);
      const smoke = createSmoke(gl, smokeProgram);
      const night = createNight(gl, fireflyProgram);
      // The latest bursts of dust and chips (D38): each a cell and the second it began, and a color with 1 for chips.
      const bursts = new Float32Array(BURSTS * 4).fill(-1);
      const kinds = new Float32Array(BURSTS * 4);
      const empty = gl.createVertexArray();
      let next = 0;
      const locate = (name: string) => gl.getUniformLocation(dustProgram, name);
      return {
        /** Hands the program that draws the blocks how wet the ground is and how much snow lies on it. */
        cover: fall.cover,
        /** Throws a burst for one changed block at `time` seconds: chips of the block dug out, or dust at the foot of the block put in. */
        burst(
          cell: readonly [number, number, number],
          block: number,
          dug: boolean,
          time: number
        ) {
          const [red, green, blue] = dustOf(pixels, block);
          bursts.set([cell[0], cell[1], cell[2], time], next * 4);
          kinds.set(
            dug
              ? [red, green, blue, 1]
              : [0.55 + red * 0.4, 0.53 + green * 0.4, 0.5 + blue * 0.4, 0],
            next * 4
          );
          next = (next + 1) % BURSTS;
        },
        /** Draws the smoke, the fireflies, then what falls, over the scene's depth. */
        draw(
          orbit: Orbit,
          time: number,
          camera: Float32Array,
          light: Light,
          sky: Weather
        ) {
          smoke.draw(camera, time, light, sky, gale);
          night.draw(camera, time, light, sky);
          fall.draw(orbit, time, camera, sky, gale);
          activate(gl, dustProgram);
          gl.uniformMatrix4fv(locate("uViewProjection"), false, camera);
          gl.uniform1f(locate("uTime"), time);
          gl.uniform4fv(locate("uBursts"), bursts);
          gl.uniform4fv(locate("uKinds"), kinds);
          gl.bindVertexArray(empty);
          gl.drawArrays(gl.POINTS, 0, BURSTS * BITS);
        },
        /** Lets the GPU go of everything in the air. */
        release() {
          fall.release();
          smoke.release();
          night.release();
          gl.deleteVertexArray(empty);
        },
        /** Replaces what the blocks decide for the air over them: where a drop stops, where the chimneys smoke, where the fireflies live. */
        scenery(next: {
          readonly chimneys: Float32Array;
          readonly fireflies: Float32Array;
          readonly roof: Uint8Array;
        }) {
          fall.roof(next.roof);
          smoke.chimneys(next.chimneys);
          night.homes(next.fireflies);
        },
        /** Moves how wet and how snowed the island is on to `time` seconds. */
        step: fall.step,
      };
    }
  );
}
