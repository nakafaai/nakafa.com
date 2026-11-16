import { Option } from "effect";
import { uploadMap } from "@/components/island/buffers";
import type { Weather } from "@/lib/island/sky";
import {
  createWind,
  poseOf,
  stepWind,
  WIND_CYCLE,
  WIND_FORCE,
  WIND_FROM,
  WIND_SIDE,
  WIND_SPAN,
} from "@/lib/island/wind";

/**
 * The texture unit the lean map takes while the world is drawn. The edge pass
 * puts the frame's own depth there afterwards, which no program may read
 * while it draws into that frame.
 */
const UNIT = 2;

/**
 * The wind on the GPU (ADR 0047, D32): every tree's swing, moved on as the
 * world is drawn, its lean as the map the shaders read, and the wind's time
 * and force for each program that draws what the wind moves.
 */
export function createGale(gl: WebGL2RenderingContext) {
  const wind = createWind();
  const lean = uploadMap(gl, WIND_SIDE);
  let stepped = Option.none<number>();
  return {
    /** Hands the program in use the wind at `time` seconds under a weather. */
    blow(
      locate: (name: string) => WebGLUniformLocation | null,
      time: number,
      sky: Weather
    ) {
      lean.bind(UNIT);
      gl.uniform1i(locate("uLean"), UNIT);
      gl.uniform4f(
        locate("uWind"),
        WIND_FROM,
        WIND_SPAN,
        time % WIND_CYCLE,
        poseOf(time)
      );
      gl.uniform1f(locate("uWindForce"), WIND_FORCE[sky]);
    },
    /** Lets the GPU go of the lean map. */
    release() {
      lean.release();
    },
    /** Moves every tree's swing on to `time` seconds under a weather, and hands the shaders its lean. */
    step(time: number, sky: Weather) {
      stepWind(
        wind,
        time,
        time - Option.getOrElse(stepped, () => time),
        WIND_FORCE[sky]
      );
      stepped = Option.some(time);
      lean.write(wind.map);
    },
  };
}
