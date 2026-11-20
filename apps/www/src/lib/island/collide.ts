import { Array as Arr, Match, Option, Schema } from "effect";
import type { Land } from "@/lib/island/land/ground";
import { standAt } from "@/lib/island/land/ground";

/**
 * What a walker cannot pass (ADR 0047, D22): a trunk, a boulder or a round
 * wall as a circle, and a house, a bench or a fence as a rectangle that
 * reaches `wide` blocks either way along x and `deep` along z from its
 * middle, its quarter turn already taken.
 */
export const Blocker = Schema.Union([
  Schema.TaggedStruct("round", {
    radius: Schema.Finite,
    x: Schema.Finite,
    z: Schema.Finite,
  }),
  Schema.TaggedStruct("box", {
    deep: Schema.Finite,
    wide: Schema.Finite,
    x: Schema.Finite,
    z: Schema.Finite,
  }),
]);
export type Blocker = typeof Blocker.Type;

/**
 * A bridge's deck, which is ground too (ADR 0050, W2): its middle, the height
 * its ends rest at, and whether it runs along x or along z.
 */
export const Deck = Schema.Struct({
  lengthwise: Schema.Literals(["x", "z"]),
  x: Schema.Finite,
  y: Schema.Finite,
  z: Schema.Finite,
});
export type Deck = typeof Deck.Type;

/** Everything a walker meets about a place: what it cannot pass, and the decks it walks over. */
export const Standing = Schema.Struct({
  blockers: Schema.Array(Blocker),
  decks: Schema.Array(Deck),
});
export type Standing = typeof Standing.Type;

/**
 * A bridge as a walker meets it, in blocks: its deck reaches `half` either
 * way along its length and `walk` to either side, stands `foot` over its seat
 * at its ends and `rise` higher at mid span, and a rail `rail` thick runs
 * `side` from its middle on either side (8 m long, 1.6 m between the rails,
 * 1.2 m up at mid span).
 */
export const BRIDGE = {
  foot: 0.13,
  half: 4.44,
  rail: 0.07,
  rise: 1.2,
  side: 1.02,
  walk: 0.95,
} as const;

/** How high a deck stands at a place, none where the place is not over it: lowest at its ends, arched up to mid span. */
function deckHeight(deck: Deck, x: number, z: number) {
  const [along, across] =
    deck.lengthwise === "x"
      ? [x - deck.x, z - deck.z]
      : [z - deck.z, x - deck.x];
  return Math.abs(along) <= BRIDGE.half && Math.abs(across) <= BRIDGE.walk
    ? Option.some(
        deck.y + BRIDGE.foot + BRIDGE.rise * (1 - (along / BRIDGE.half) ** 2)
      )
    : Option.none();
}

/** The height of the highest deck over a place, none where no bridge crosses it. */
export function deckAt(decks: readonly Deck[], x: number, z: number) {
  return Arr.reduce(decks, Option.none<number>(), (best, deck) =>
    Option.match(deckHeight(deck, x, z), {
      onNone: () => best,
      onSome: (height) =>
        Option.some(
          Math.max(
            height,
            Option.getOrElse(best, () => height)
          )
        ),
    })
  );
}

/** Where a walker's feet rest at a place: on the land, or on a bridge's deck over it. */
export function groundAt(
  land: Land,
  decks: readonly Deck[],
  x: number,
  z: number
) {
  const stand = standAt(land, x, z);
  return Option.match(deckAt(decks, x, z), {
    onNone: () => stand,
    onSome: (deck) => Math.max(stand, deck),
  });
}

/** A place moved out of a circle it lies within `body` blocks of, along the shortest way. */
function clearOfRound(
  blocker: Extract<Blocker, { _tag: "round" }>,
  x: number,
  z: number,
  body: number
) {
  const [dx, dz] = [x - blocker.x, z - blocker.z];
  const distance = Math.hypot(dx, dz);
  const reach = blocker.radius + body;
  if (distance >= reach) {
    return [x, z] as const;
  }
  // A place on the very middle has no way out of its own; it leaves along +x.
  return distance < 1e-6
    ? ([blocker.x + reach, z] as const)
    : ([
        blocker.x + (dx / distance) * reach,
        blocker.z + (dz / distance) * reach,
      ] as const);
}

/** A place moved out of a rectangle it lies within `body` blocks of: off its nearest edge or corner, or out through its nearest side from inside. */
function clearOfBox(
  blocker: Extract<Blocker, { _tag: "box" }>,
  x: number,
  z: number,
  body: number
) {
  const [dx, dz] = [x - blocker.x, z - blocker.z];
  const nearX = Math.min(blocker.wide, Math.max(-blocker.wide, dx));
  const nearZ = Math.min(blocker.deep, Math.max(-blocker.deep, dz));
  const distance = Math.hypot(dx - nearX, dz - nearZ);
  if (distance >= body) {
    return [x, z] as const;
  }
  if (distance > 1e-6) {
    return [
      blocker.x + nearX + ((dx - nearX) / distance) * body,
      blocker.z + nearZ + ((dz - nearZ) / distance) * body,
    ] as const;
  }
  const sideX = blocker.wide - Math.abs(dx);
  const sideZ = blocker.deep - Math.abs(dz);
  return sideX < sideZ
    ? ([blocker.x + (dx < 0 ? -1 : 1) * (blocker.wide + body), z] as const)
    : ([x, blocker.z + (dz < 0 ? -1 : 1) * (blocker.deep + body)] as const);
}

/**
 * A place moved clear of everything a body `body` blocks wide cannot pass
 * (ADR 0047, D22): out of each blocker along the shortest way, so a walker
 * that pushes against a wall or a trunk slides along it, and one that starts
 * inside something is let out instead of held.
 */
export function clearOf(
  blockers: readonly Blocker[],
  x: number,
  z: number,
  body: number
) {
  return Arr.reduce(blockers, [x, z] as const, (place, blocker) =>
    Match.valueTags(blocker, {
      box: (found) => clearOfBox(found, place[0], place[1], body),
      round: (found) => clearOfRound(found, place[0], place[1], body),
    })
  );
}

/** Whether a body `body` blocks wide at a place would stand in something it cannot pass. */
export function blocksAt(
  blockers: readonly Blocker[],
  x: number,
  z: number,
  body: number
) {
  return Arr.some(blockers, (blocker) =>
    Match.valueTags(blocker, {
      box: (found) =>
        Math.abs(x - found.x) < found.wide + body &&
        Math.abs(z - found.z) < found.deep + body,
      round: (found) =>
        Math.hypot(x - found.x, z - found.z) < found.radius + body,
    })
  );
}
