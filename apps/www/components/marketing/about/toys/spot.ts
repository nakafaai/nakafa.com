import { type ThingName, ThingNameSchema } from "@repo/mascot/thing/name";
import { Schema } from "effect";
import { AnchorSchema } from "@/components/marketing/about/toys/place";

/** What a spot of a gap draws: an animal of the herd at its index, or one of Nina's things. */
const PictureSchema = Schema.Union([
  Schema.Struct({ index: Schema.Finite, kind: Schema.Literal("animal") }),
  Schema.Struct({ kind: Schema.Literal("thing"), name: ThingNameSchema }),
]);

/** What a spot of a gap draws. */
export type GapPicture = typeof PictureSchema.Type;

/** One spot of a gap: its key, what it draws, and its anchor beside the part. */
const SpotSchema = Schema.Struct({
  anchor: AnchorSchema,
  key: Schema.String,
  picture: PictureSchema,
});

/** One spot of a gap. The page places it with `within` its part and its anchor. */
export type GapSpot = typeof SpotSchema.Type;

/** Where a spot stands beside its part, without the height that the gap sets for every spot. */
type SpotAnchor = Omit<typeof AnchorSchema.Type, "y">;

/** Keeps a phone's spot of a toy inside the part, away from both edges. */
function inset(x: number) {
  return Math.min(0.88, Math.max(0.12, x));
}

/**
 * The spots of the small herd in the space where the part `part` begins, around
 * `x`, a fraction of the part's width: two animals of the herd, the first at `x`
 * and the second toward the middle of the page, with one or two things beside
 * them that say what comes next. Their heights differ a little, so the herd
 * stands loosely. Each spot is in the part's top padding, which no text or window
 * reaches. From 1024 px the herd stands close together; on a phone and a tablet,
 * where a fraction is fewer pixels, the things sit further out and the second
 * animal stands at the far side, so every width keeps the whole herd.
 */
export function gapSpots(
  part: string,
  x: number,
  animals: readonly [number, number],
  things: readonly [ThingName] | readonly [ThingName, ThingName]
): GapSpot[] {
  const [first, second] = animals;
  const [before, after] = things;
  const side = x <= 0.5 ? 1 : -1;
  const animalAt = (
    name: string,
    index: number,
    spot: SpotAnchor
  ): GapSpot => ({
    anchor: { dx: -28, ...spot, y: 0 },
    key: `${part}-gap-${name}`,
    picture: { index, kind: "animal" },
  });
  const thingAt = (name: ThingName, spot: SpotAnchor): GapSpot => ({
    anchor: { dx: -24, ...spot, y: 0 },
    key: `${part}-gap-${name}-${spot.minWidth === undefined ? "narrow" : "wide"}`,
    picture: { kind: "thing", name },
  });
  return [
    animalAt("animal", first, { dy: 28, x }),
    animalAt("second-wide", second, {
      dy: 40,
      minWidth: 1024,
      x: x + side * 0.16,
    }),
    animalAt("second-narrow", second, {
      dy: 40,
      maxWidth: 1023,
      x: side === 1 ? 0.88 : 0.12,
    }),
    thingAt(before, { dy: 40, minWidth: 1024, x: x - side * 0.07 }),
    thingAt(before, { dy: 40, maxWidth: 1023, x: inset(x - side * 0.2) }),
    ...(after === undefined
      ? []
      : [
          thingAt(after, { dy: 20, minWidth: 1024, x: x + side * 0.08 }),
          thingAt(after, { dy: 20, maxWidth: 1023, x: inset(x + side * 0.2) }),
        ]),
  ];
}
