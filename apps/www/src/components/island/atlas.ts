import { Array as Arr } from "effect";
import { ATLAS_SIZE, atlasPixels } from "@/lib/island/atlas";
import { mipsOf } from "@/lib/island/mips";
import { repaintFor, type Season } from "@/lib/island/season";
import { TILE } from "@/lib/island/tiles/paint";

/**
 * The block atlas on the GPU, painted for `season` (ADR 0047, D20), with each
 * tile's own smaller levels, so a far face shows its color, not the noise of
 * its pixels. It answers the texture and the painted pixels, which the air
 * reads its dust and chips' colors from (D38).
 */
export function createAtlas(gl: WebGL2RenderingContext, season: Season) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  const painted = repaintFor(atlasPixels(), season);
  const levels = mipsOf(painted, ATLAS_SIZE, TILE);
  Arr.forEach(levels, (pixels, level) =>
    gl.texImage2D(
      gl.TEXTURE_2D,
      level,
      gl.RGBA,
      ATLAS_SIZE / 2 ** level,
      ATLAS_SIZE / 2 ** level,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels
    )
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, levels.length - 1);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.NEAREST_MIPMAP_NEAREST
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return { painted, texture };
}
