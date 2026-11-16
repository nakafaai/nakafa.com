import { Option } from "effect";
import { programOf } from "@/components/island/buffers";
import { createFall } from "@/components/island/fall";
import { createNight } from "@/components/island/night";
import { createSmoke } from "@/components/island/smoke";
import type { createGale } from "@/components/island/wind";
import {
  FIREFLY_FRAGMENT,
  FIREFLY_VERTEX,
  SMOKE_FRAGMENT,
  SMOKE_VERTEX,
  WEATHER_FRAGMENT,
  WEATHER_VERTEX,
} from "@/lib/island/air";
import type { Orbit } from "@/lib/island/camera";
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
  gale: ReturnType<typeof createGale>
) {
  return Option.map(
    Option.all([
      programOf(gl, WEATHER_VERTEX, WEATHER_FRAGMENT),
      programOf(gl, SMOKE_VERTEX, SMOKE_FRAGMENT),
      programOf(gl, FIREFLY_VERTEX, FIREFLY_FRAGMENT),
    ]),
    ([weatherProgram, smokeProgram, fireflyProgram]) => {
      const fall = createFall(gl, weatherProgram);
      const smoke = createSmoke(gl, smokeProgram);
      const night = createNight(gl, fireflyProgram);
      return {
        /** Hands the program that draws the blocks how wet the ground is and how much snow lies on it. */
        cover: fall.cover,
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
        },
        /** Lets the GPU go of everything in the air. */
        release() {
          fall.release();
          smoke.release();
          night.release();
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
