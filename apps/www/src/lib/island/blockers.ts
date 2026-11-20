import type { Thing } from "@repo/backend/confect/island/things";
import { Array as Arr, Match, MutableHashMap, Option, Schema } from "effect";
import type { Blocker, Standing } from "@/lib/island/collide";
import { BRIDGE } from "@/lib/island/collide";
import { CHUNK, keyOf } from "@/lib/island/land/chunk";
import type { Wild } from "@/lib/island/land/flora";
import { floraOf } from "@/lib/island/land/flora";
import type { Land } from "@/lib/island/land/ground";
import { placeAt, seatOf } from "@/lib/island/land/site";

/** How much room a thing takes from a walker: a circle, a rectangle, a deck to walk over, or none at all. */
const Footprint = Schema.Union([
  Schema.TaggedStruct("round", { radius: Schema.Finite }),
  Schema.TaggedStruct("box", { deep: Schema.Finite, wide: Schema.Finite }),
  Schema.TaggedStruct("deck", {}),
  Schema.TaggedStruct("open", {}),
]);

/** A circle of `radius` blocks about a thing's middle. */
function round(radius: number) {
  return { _tag: "round", radius } as const;
}

/** A rectangle that reaches `wide` blocks to either side of a thing's middle and `deep` blocks to its front and back, before its turn. */
function box(wide: number, deep: number) {
  return { _tag: "box", deep, wide } as const;
}

/** What a walker walks straight through: a flower, a reed, what lies under water, and the ball, which is a loose thing it kicks. */
const OPEN = { _tag: "open" } as const;

/**
 * The room each thing takes from a walker, in blocks of 0.9 m (ADR 0047, D22;
 * ADR 0050, W2), measured from its model: a tree is its trunk and root flare,
 * never its crown; a building is its walls, a little inside its eaves; and a
 * bridge is a deck between two rails.
 */
export const FOOTPRINTS = {
  ball: OPEN,
  balloon: round(0.8),
  banana: round(0.35),
  bench: box(0.89, 0.36),
  boat: box(1.2, 2.6),
  brain: OPEN,
  bridge: { _tag: "deck" },
  bush: OPEN,
  campfire: round(0.6),
  casuarina: round(0.4),
  coral: OPEN,
  cottage: box(3.1, 2.8),
  fence: box(1.11, 0.1),
  flame: round(0.55),
  flowerbed: box(1.11, 0.56),
  kite: round(0.15),
  lantern: round(0.2),
  library: box(3.4, 2.8),
  lighthouse: round(2.5),
  lily: OPEN,
  mango: round(0.55),
  palm: round(0.45),
  pine: round(0.5),
  reed: OPEN,
  rocks: round(0.65),
  saung: box(1.9, 1.9),
  seagrass: OPEN,
  sunflower: OPEN,
  well: round(1),
  windmill: round(2.6),
} satisfies Record<Thing, typeof Footprint.Type>;

/** How far a wild plant's trunk or a wild rock keeps a walker off, in blocks, for a plant of its kind's own size; a kind with no reach is walked through. */
const TRUNKS = {
  banana: 0.35,
  brain: 0,
  bush: 0,
  coral: 0,
  flame: 0.55,
  lily: 0,
  palm: 0.45,
  pine: 0.5,
  reed: 0,
  rocks: 0.65,
  seagrass: 0,
  tree: 0.55,
} as const satisfies Record<Wild, number>;

/** The largest reach of any footprint from its middle, in blocks, so a search about a place finds what stands in a neighbouring chunk. */
const MARGIN = 5;

/** How many chunks and how many areas a cache keeps before it starts over. */
const KEPT = { areas: 24, chunks: 96 } as const;

/** What a bridge set down at a place gives a walker: a deck, and a rail along each side of it. */
function bridgeOf(land: Land, x: number, z: number, turn: number): Standing {
  const lengthwise = turn % 2 === 0 ? "x" : "z";
  const rail = (side: number): Blocker =>
    lengthwise === "x"
      ? {
          _tag: "box",
          deep: BRIDGE.rail,
          wide: BRIDGE.half,
          x,
          z: z + side * BRIDGE.side,
        }
      : {
          _tag: "box",
          deep: BRIDGE.half,
          wide: BRIDGE.rail,
          x: x + side * BRIDGE.side,
          z,
        };
  return {
    blockers: [rail(-1), rail(1)],
    decks: [{ lengthwise, x, y: seatOf(land, "bridge", x, z, turn), z }],
  };
}

/** What one thing set down at a place gives a walker. */
function thingOf(
  land: Land,
  kind: Thing,
  x: number,
  z: number,
  turn: number
): Standing {
  return Match.valueTags(FOOTPRINTS[kind], {
    box: ({ deep, wide }): Standing => ({
      blockers: [
        turn % 2 === 0
          ? { _tag: "box", deep, wide, x, z }
          : { _tag: "box", deep: wide, wide: deep, x, z },
      ],
      decks: [],
    }),
    deck: () => bridgeOf(land, x, z, turn),
    open: (): Standing => ({ blockers: [], decks: [] }),
    round: ({ radius }): Standing => ({
      blockers: [{ _tag: "round", radius, x, z }],
      decks: [],
    }),
  });
}

/** Several standings as one. */
function joined(parts: readonly Standing[]): Standing {
  return {
    blockers: Arr.flatMap(parts, (part) => part.blockers),
    decks: Arr.flatMap(parts, (part) => part.decks),
  };
}

/**
 * What stands in one chunk of the land (ADR 0047, D22): the trunks and rocks
 * that grow there wild, each as wide as it grew, and the footprint of every
 * thing the learner set down there.
 */
export function standingOf(land: Land, cx: number, cz: number): Standing {
  const wild = Arr.map(
    Arr.filter(floraOf(land, cx, cz), (plant) => TRUNKS[plant.kind] > 0),
    (plant): Blocker => ({
      _tag: "round",
      radius: TRUNKS[plant.kind] * plant.size,
      x: plant.x,
      z: plant.z,
    })
  );
  const things = Arr.map(
    Option.getOrElse(MutableHashMap.get(land.things, keyOf(cx, cz)), () => []),
    (thing) => {
      const [x, z] = placeAt({ at: thing.at, cx, cz });
      return thingOf(land, thing.kind, x, z, thing.turn);
    }
  );
  return joined([{ blockers: wild, decks: [] }, ...things]);
}

/** What a game remembers of what stands on its land, by chunk and by area, each with the revision of the land it was read at. */
export function cacheOf() {
  return {
    areas: MutableHashMap.empty<
      string,
      { readonly revision: number; readonly standing: Standing }
    >(),
    chunks: MutableHashMap.empty<
      number,
      { readonly revision: number; readonly standing: Standing }
    >(),
  };
}

/** What stands in one chunk, read again only when the land changed since it was last read. */
function chunkStanding(
  cache: ReturnType<typeof cacheOf>,
  land: Land,
  revision: number,
  cx: number,
  cz: number
) {
  const key = keyOf(cx, cz);
  const held = Option.filter(
    MutableHashMap.get(cache.chunks, key),
    (entry) => entry.revision === revision
  );
  return Option.getOrElse(
    Option.map(held, (entry) => entry.standing),
    () => {
      if (MutableHashMap.size(cache.chunks) >= KEPT.chunks) {
        MutableHashMap.clear(cache.chunks);
      }
      const standing = standingOf(land, cx, cz);
      MutableHashMap.set(cache.chunks, key, { revision, standing });
      return standing;
    }
  );
}

/**
 * Everything a walker meets within `reach` blocks of a place, from every
 * chunk that could reach into it. The answer is kept by its chunks and by the
 * store's `revision`, so a frame that stays in one area of an unchanged land
 * reads nothing again.
 */
export function standingAbout(
  cache: ReturnType<typeof cacheOf>,
  land: Land,
  revision: number,
  place: readonly [number, number],
  reach: number
): Standing {
  const span = reach + MARGIN;
  const from = [
    Math.floor((place[0] - span) / CHUNK),
    Math.floor((place[1] - span) / CHUNK),
  ] as const;
  const to = [
    Math.floor((place[0] + span) / CHUNK),
    Math.floor((place[1] + span) / CHUNK),
  ] as const;
  const key = `${from[0]}:${from[1]}:${to[0]}:${to[1]}`;
  const held = Option.filter(
    MutableHashMap.get(cache.areas, key),
    (entry) => entry.revision === revision
  );
  return Option.getOrElse(
    Option.map(held, (entry) => entry.standing),
    () => {
      if (MutableHashMap.size(cache.areas) >= KEPT.areas) {
        MutableHashMap.clear(cache.areas);
      }
      const standing = joined(
        Arr.flatMap(Arr.range(from[0], to[0]), (cx) =>
          Arr.map(Arr.range(from[1], to[1]), (cz) =>
            chunkStanding(cache, land, revision, cx, cz)
          )
        )
      );
      MutableHashMap.set(cache.areas, key, { revision, standing });
      return standing;
    }
  );
}
