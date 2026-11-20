import { Placed } from "@repo/backend/confect/island/chunk";
import { Array as Arr, MutableHashMap, Option, Schema } from "effect";
import { keyOf } from "@/lib/island/land/chunk";
import {
  clearedOf,
  liftOf,
  paintOf,
  setCleared,
  setLift,
  setPaint,
} from "@/lib/island/land/edits";
import type { Land } from "@/lib/island/land/ground";

/** What a learner changes at a lattice point: how far it stands from the seed's own ground, in eighths of a block; the surface painted on it; whether its wild plant is cleared, 1 or 0. */
const Layer = Schema.Literals(["lift", "paint", "clear"]);

/**
 * One thing the learner changed, with what it was before, so it can be taken
 * back (ADR 0050, W2 and W4): one layer of one lattice point, or what stands
 * at one place of a chunk's half-block grid, none for nothing.
 */
export const Change = Schema.Union([
  Schema.TaggedStruct("point", {
    from: Schema.Int,
    i: Schema.Int,
    j: Schema.Int,
    layer: Layer,
    to: Schema.Int,
  }),
  Schema.TaggedStruct("thing", {
    at: Schema.Int,
    cx: Schema.Int,
    cz: Schema.Int,
    from: Schema.Option(Placed),
    to: Schema.Option(Placed),
  }),
]);
export type Change = typeof Change.Type;

/** What a layer of a lattice point holds now. */
function heldOf(land: Land, layer: typeof Layer.Type, i: number, j: number) {
  if (layer === "lift") {
    return liftOf(land, i, j);
  }
  return layer === "paint"
    ? paintOf(land, i, j)
    : Number(clearedOf(land, i, j));
}

/** The change that sets one layer of a lattice point, none when it already holds that. */
export function pointTo(
  land: Land,
  layer: typeof Layer.Type,
  i: number,
  j: number,
  to: number
) {
  const from = heldOf(land, layer, i, j);
  return from === to
    ? Option.none()
    : Option.some({ _tag: "point", from, i, j, layer, to } as const);
}

/** What stands at a place of a chunk's half-block grid, none for nothing. */
export function thingAt(land: Land, cx: number, cz: number, at: number) {
  return Option.flatMap(
    MutableHashMap.get(land.things, keyOf(cx, cz)),
    (things) => Arr.findFirst(things, (thing) => thing.at === at)
  );
}

/** The change that sets what stands at a place, none for taking it away. */
export function thingTo(
  land: Land,
  cx: number,
  cz: number,
  at: number,
  to: Option.Option<typeof Placed.Type>
) {
  return {
    _tag: "thing",
    at,
    cx,
    cz,
    from: thingAt(land, cx, cz, at),
    to,
  } as const;
}

/** Writes what stands at a place of a chunk. */
function setThing(
  land: Land,
  cx: number,
  cz: number,
  at: number,
  to: Option.Option<typeof Placed.Type>
) {
  const key = keyOf(cx, cz);
  const others = Arr.filter(
    Option.getOrElse(MutableHashMap.get(land.things, key), () => []),
    (thing) => thing.at !== at
  );
  MutableHashMap.set(
    land.things,
    key,
    Arr.appendAll(others, Option.toArray(to))
  );
}

/** Writes changes into the land, in order. */
export function applyChanges(land: Land, changes: readonly Change[]) {
  for (const change of changes) {
    if (change._tag === "thing") {
      setThing(land, change.cx, change.cz, change.at, change.to);
    } else if (change.layer === "lift") {
      setLift(land, change.i, change.j, change.to);
    } else if (change.layer === "paint") {
      setPaint(land, change.i, change.j, change.to);
    } else {
      setCleared(land, change.i, change.j, change.to === 1);
    }
  }
}

/** The changes that take a step back: each one turned around, the last first. */
export function undoneOf(changes: readonly Change[]): readonly Change[] {
  return Arr.map(Arr.reverse(changes), (change) =>
    change._tag === "thing"
      ? { ...change, from: change.to, to: change.from }
      : { ...change, from: change.to, to: change.from }
  );
}

/** Changes of one kind with those on the same subject joined: each subject once, from what its first change began with to what its last ended with. */
function joined<Item extends { readonly from: unknown }>(
  changes: readonly Item[],
  subjectOf: (change: Item) => string
) {
  const subjects = MutableHashMap.empty<string, Item>();
  for (const change of changes) {
    const subject = subjectOf(change);
    MutableHashMap.set(
      subjects,
      subject,
      Option.match(MutableHashMap.get(subjects, subject), {
        onNone: () => change,
        onSome: (first) => ({ ...change, from: first.from }),
      })
    );
  }
  return Arr.fromIterable(MutableHashMap.values(subjects));
}

const samePlaced = Option.makeEquivalence(Schema.toEquivalence(Placed));

/**
 * A step with more changes joined to it, so one stroke of a brush is one step
 * however many times it passed over a point: each subject keeps what it was
 * before the stroke and what it is after it, and one that ended where it
 * began drops out.
 */
export function joinedOf(
  step: readonly Change[],
  more: readonly Change[]
): readonly Change[] {
  const all = Arr.appendAll(step, more);
  const points = joined(
    Arr.filter(
      all,
      (change): change is Extract<Change, { _tag: "point" }> =>
        change._tag === "point"
    ),
    (change) => `${change.layer}:${change.i}:${change.j}`
  );
  const things = joined(
    Arr.filter(
      all,
      (change): change is Extract<Change, { _tag: "thing" }> =>
        change._tag === "thing"
    ),
    (change) => `${change.cx}:${change.cz}:${change.at}`
  );
  return [
    ...Arr.filter(points, (change) => change.from !== change.to),
    ...Arr.filter(things, (change) => !samePlaced(change.from, change.to)),
  ];
}
