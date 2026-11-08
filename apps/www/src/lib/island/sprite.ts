import { Array as Arr, Option, Record, Schema } from "effect";
import { paletteBytes, paletteIndex, RAMPS } from "@/lib/island/palette";

/** The character a sprite row writes for a clear pixel. */
const CLEAR = ".";

/**
 * A pixel sprite as data (ADR 0042, D16): each frame is a few rows of
 * characters, and the key gives each character a ramp and a tone of the
 * palette. One character is one art pixel on screen.
 */
export const Sprite = Schema.Struct({
  fps: Schema.Finite,
  frames: Schema.Array(Schema.Array(Schema.String)),
  key: Schema.Record(
    Schema.String,
    Schema.Tuple([
      Schema.Literals(Record.keys(RAMPS)),
      Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 3 })),
    ])
  ),
});
export type Sprite = typeof Sprite.Type;

/** The width of a frame: its longest row. */
function widthOf(frame: readonly string[]) {
  return Arr.reduce(frame, 0, (widest, row) => Math.max(widest, row.length));
}

/**
 * Packs every frame of every sprite into one texture, side by side in a single
 * row, with one clear texel between frames so sampling never bleeds. A texel's
 * alpha is its palette index plus one, so 0 stays clear and the shaders know
 * which ramp a sprite pixel belongs to. Returns the texels and where each
 * sprite's frames lie.
 */
export function packAtlas<Name extends string>(sprites: Record<Name, Sprite>) {
  const palette = paletteBytes();
  const entries = Record.toEntries(sprites);
  const all = Arr.flatMap(entries, ([, sprite]) => sprite.frames);
  const width = Arr.reduce(
    all,
    0,
    (total, frame) => total + widthOf(frame) + 1
  );
  const height = Arr.reduce(all, 0, (tallest, frame) =>
    Math.max(tallest, frame.length)
  );
  const pixels = new Uint8Array(width * height * 4);
  let cursor = 0;
  const frames = Record.map(sprites, (sprite) =>
    Arr.map(sprite.frames, (frame) => {
      const placed = {
        height: frame.length,
        width: widthOf(frame),
        x: cursor,
        y: 0,
      };
      Arr.forEach(frame, (row, y) => {
        Arr.forEach(Arr.fromIterable(row), (glyph, x) => {
          const paint =
            glyph === CLEAR ? Option.none() : Record.get(sprite.key, glyph);
          if (Option.isNone(paint)) {
            return;
          }
          const index = paletteIndex(paint.value[0], paint.value[1]);
          pixels.set(
            [...palette.subarray(index * 4, index * 4 + 3), index + 1],
            (y * width + cursor + x) * 4
          );
        });
      });
      cursor += placed.width + 1;
      return placed;
    })
  );
  return { frames, height, pixels, width };
}
