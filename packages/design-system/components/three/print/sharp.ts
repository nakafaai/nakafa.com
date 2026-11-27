import type { StageBudget } from "@repo/design-system/components/three/stage/tier";
import { Match, Schema } from "effect";

/**
 * How many pixels a print is drawn with, so it is sharp at every zoom: as
 * many as it covers on the screen, and no more than the device can spare. A
 * print drawn for the screen it is seen on needs no more memory than that
 * screen, and one a reader zooms into is drawn again at the size they now
 * see it.
 */

/** How the camera sees a print: in perspective from a distance, or in parallel at a zoom. */
const ViewSchema = Schema.Union([
  Schema.Struct({
    distance: Schema.Finite,
    fov: Schema.Finite,
    kind: Schema.Literal("perspective"),
  }),
  Schema.Struct({
    kind: Schema.Literal("orthographic"),
    zoom: Schema.Finite,
  }),
]);

/** The size of an image in pixels. */
const PixelsSchema = Schema.Struct({
  height: Schema.Finite,
  width: Schema.Finite,
});
type Pixels = typeof PixelsSchema.Type;

/** The fewest pixels the longer side of a print is drawn with. */
const FLOOR = 64;

/**
 * What one stage tier spares for print: the most pixels along a print's
 * longer side, how many samples keep a print sharp when seen at a slant,
 * and how many segments a print wrapped full circle is built from.
 */
export function printBudget(tier: StageBudget["tier"]) {
  return Match.value(tier).pipe(
    Match.when("full", () => ({ anisotropy: 16, around: 64, limit: 2048 })),
    Match.when("light", () => ({ anisotropy: 8, around: 64, limit: 2048 })),
    Match.when("low", () => ({ anisotropy: 4, around: 40, limit: 1024 })),
    Match.when("plain", () => ({ anisotropy: 4, around: 40, limit: 1024 })),
    Match.exhaustive
  );
}

/**
 * How many pixels of the drawing buffer one metre of a print covers, seen
 * square on: the buffer's `height` in pixels over the height of the view at
 * the print, times how much the scene scales the print.
 */
export function screenDensity(
  view: typeof ViewSchema.Type,
  height: number,
  scale: number
): number {
  return Match.value(view).pipe(
    Match.discriminatorsExhaustive("kind")({
      orthographic: (parallel) => parallel.zoom * scale,
      perspective: (lens) => {
        const span =
          2 * Math.tan((lens.fov * Math.PI) / 360) * Math.max(lens.distance, 0);
        return span > 0 ? (height / span) * scale : Number.POSITIVE_INFINITY;
      },
    })
  );
}

/**
 * The image a print of `width` by `height` metres is drawn into at a
 * density of pixels per metre: its longer side the next power of two at or
 * above what the screen shows, between the floor and the tier's `limit`,
 * and its shorter side in proportion, so a pixel of the image is square on
 * the object.
 */
export function printPixels(
  sheet: { readonly height: number; readonly width: number },
  density: number,
  limit: number
): Pixels {
  const longer = Math.max(sheet.width, sheet.height);
  const wanted = Math.min(limit, Math.max(FLOOR, longer * density));
  const side = Math.min(limit, 2 ** Math.ceil(Math.log2(wanted)));
  const perMetre = side / longer;
  return {
    height: Math.max(1, Math.round(sheet.height * perMetre)),
    width: Math.max(1, Math.round(sheet.width * perMetre)),
  };
}

/** How many times too large an image may be before it is drawn again smaller, to give its memory back. */
const SLACK = 4;

/**
 * Whether a print drawn at `current` must be drawn again for `wanted`:
 * larger as soon as the reader sees it larger, so it stays sharp, and
 * smaller only once it is far too large, so a zoom in and out again does
 * not draw it twice.
 */
export function needsRedraw(current: Pixels, wanted: Pixels): boolean {
  return (
    wanted.width > current.width ||
    wanted.height > current.height ||
    wanted.width * SLACK <= current.width
  );
}
