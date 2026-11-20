import { Option } from "effect";
import { activate, programOf } from "@/components/island/buffers";
import { createDrift } from "@/components/island/drift";
import { createFall } from "@/components/island/fall";
import { createNight } from "@/components/island/night";
import { createSmoke } from "@/components/island/smoke";
import type { createGale } from "@/components/island/wind";
import type { Burst } from "@/lib/island/air";
import {
  BITS,
  BURST_LOOKS,
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
import {
  BUTTERFLY_FRAGMENT,
  BUTTERFLY_VERTEX,
  LEAF_FRAGMENT,
  LEAF_VERTEX,
} from "@/lib/island/flutter";
import type { Season } from "@/lib/island/season";
import type { Light, Weather } from "@/lib/island/sky";

/** A uniform finder of a program. */
type Uniforms = (name: string) => WebGLUniformLocation | null;

/**
 * What moves in the air over the land, on the GPU (ADR 0047, D33, D36, D38
 * and D41; ADR 0050, W10): the falling weather and what it leaves on the
 * ground, the chimneys' smoke, the fireflies after dusk, the leaves and the
 * butterflies, and the bursts a change throws up. `ground` hands a program
 * the window of land about the camera, which is where everything that lands
 * reads the ground, so all of it works at any place of the land. The painter
 * steps it, hands it what stands about the camera, and draws it over the
 * scene; none when the browser refuses one of its programs.
 */
export function createAir(
  gl: WebGL2RenderingContext,
  gale: ReturnType<typeof createGale>,
  ground: (at: Uniforms) => void,
  season: Season
) {
  return Option.map(
    Option.all([
      programOf(gl, WEATHER_VERTEX, WEATHER_FRAGMENT),
      programOf(gl, SMOKE_VERTEX, SMOKE_FRAGMENT),
      programOf(gl, FIREFLY_VERTEX, FIREFLY_FRAGMENT),
      programOf(gl, DUST_VERTEX, DUST_FRAGMENT),
      programOf(gl, LEAF_VERTEX, LEAF_FRAGMENT),
      programOf(gl, BUTTERFLY_VERTEX, BUTTERFLY_FRAGMENT),
    ]),
    ([
      weatherProgram,
      smokeProgram,
      fireflyProgram,
      dustProgram,
      leafProgram,
      butterflyProgram,
    ]) => {
      const fall = createFall(gl, weatherProgram, ground);
      const smoke = createSmoke(gl, smokeProgram);
      const night = createNight(gl, fireflyProgram);
      const drift = createDrift(
        gl,
        [leafProgram, butterflyProgram],
        ground,
        season
      );
      // The latest bursts (D38): each the place it left and the second it began, and its color with 1 for bits that leap.
      const bursts = new Float32Array(BURSTS * 4).fill(-1);
      const tints = new Float32Array(BURSTS * 4);
      const empty = gl.createVertexArray();
      let next = 0;
      const locate: Uniforms = (name) =>
        gl.getUniformLocation(dustProgram, name);
      return {
        /** Throws a burst from a place of the world (x, y, z in blocks) at `time` seconds: dust for a thing set down, chips for a thing taken, or what the brush that touched the land throws. */
        burst(
          place: readonly [number, number, number],
          kind: Burst,
          time: number
        ) {
          const look = BURST_LOOKS[kind];
          bursts.set([place[0], place[1], place[2], time], next * 4);
          tints.set([...look.color, look.leaps ? 1 : 0], next * 4);
          next = (next + 1) % BURSTS;
        },
        /** Hands a program that draws the land how wet the ground is and how much snow lies on it. */
        cover: fall.cover,
        /** Draws the smoke, the fireflies, the leaves and the butterflies, what falls, then the bursts, over the scene's depth. */
        draw(
          orbit: Orbit,
          time: number,
          camera: Float32Array,
          light: Light,
          sky: Weather
        ) {
          smoke.draw(camera, time, light, sky, gale);
          night.draw(camera, time, light, sky);
          drift.draw(camera, time, light, sky, gale);
          fall.draw(orbit, time, camera, sky, gale);
          activate(gl, dustProgram);
          gl.uniformMatrix4fv(locate("uViewProjection"), false, camera);
          gl.uniform1f(locate("uTime"), time);
          gl.uniform4fv(locate("uBursts"), bursts);
          gl.uniform4fv(locate("uTints"), tints);
          gl.bindVertexArray(empty);
          gl.drawArrays(gl.POINTS, 0, BURSTS * BITS);
        },
        /** Lets the GPU go of everything in the air. */
        release() {
          fall.release();
          smoke.release();
          night.release();
          drift.release();
          gl.deleteVertexArray(empty);
        },
        /**
         * Replaces what stands about the camera for the air over it, each a
         * run of numbers in blocks: `chimneys`, three a chimney or a fire, the
         * place its smoke leaves it (x, y, z); `fireflies`, three a firefly,
         * the middle of its loop (x, y, z); `butterflies`, three a butterfly,
         * the place it settles (x, y, z); `crowns`, four a tree, the place
         * under its crown a leaf lets go from (x, y, z) and the height of the
         * ground under the tree.
         */
        scenery(next: {
          readonly butterflies: Float32Array;
          readonly chimneys: Float32Array;
          readonly crowns: Float32Array;
          readonly fireflies: Float32Array;
        }) {
          smoke.chimneys(next.chimneys);
          night.homes(next.fireflies);
          drift.homes(next);
        },
        /** Moves how wet and how snowed the land is on to `time` seconds. */
        step: fall.step,
      };
    }
  );
}
