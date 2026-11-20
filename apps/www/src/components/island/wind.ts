import { Option } from "effect";
import type { Weather } from "@/lib/island/sky";
import {
  createWind,
  poseOf,
  stepWind,
  WIND_ALONG,
  WIND_CYCLE,
  WIND_FORCE,
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
 * The lean map on the GPU, one byte a texel, read smoothly so neighbouring
 * trees lean alike, and wrapped both ways, so one round of it covers the
 * endless land (ADR 0050, W10). `write` replaces it, `bind` puts it on a
 * texture unit.
 */
function leanMap(gl: WebGL2RenderingContext) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R8, WIND_SIDE, WIND_SIDE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  return {
    bind(unit: number) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.activeTexture(gl.TEXTURE0);
    },
    release() {
      gl.deleteTexture(texture);
    },
    write(map: Uint8Array) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        WIND_SIDE,
        WIND_SIDE,
        gl.RED,
        gl.UNSIGNED_BYTE,
        map
      );
    },
  };
}

/**
 * The wind on the GPU (ADR 0047, D32): every tree's swing, moved on as the
 * world is drawn, its lean as the map the shaders read, and the wind's time
 * and force for each program that draws what the wind moves. The map lies
 * along the wind and wraps, so it serves any place of the land, on either
 * side of the origin.
 */
export function createGale(gl: WebGL2RenderingContext) {
  const wind = createWind();
  const lean = leanMap(gl);
  lean.write(wind.map);
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
        WIND_ALONG,
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
