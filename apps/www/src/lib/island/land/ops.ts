import type { Placed } from "@repo/backend/confect/island/chunk";
import type { Operation } from "@repo/backend/confect/island/operation";
import { Array as Arr, MutableHashMap, Option } from "effect";
import type { Change } from "@/lib/island/land/changes";
import {
  CHUNK,
  indexOf,
  keyOf,
  POINTS,
  placeOf,
} from "@/lib/island/land/chunk";
import type { Land } from "@/lib/island/land/ground";

/** The codes of one chunk's stroke, by layer. */
function strokeOf() {
  return {
    clear: MutableHashMap.empty<number, number>(),
    lift: MutableHashMap.empty<number, number>(),
    paint: MutableHashMap.empty<number, number>(),
  };
}

/**
 * The operations that tell the server what a step changed (ADR 0050, W4): one
 * stroke for each chunk whose points changed, naming every point once with
 * what it holds now, then each thing set or taken, in the order it was.
 */
export function opsOf(changes: readonly Change[]): readonly Operation[] {
  const strokes = MutableHashMap.empty<number, ReturnType<typeof strokeOf>>();
  for (const change of changes) {
    if (change._tag === "point") {
      const key = keyOf(
        Math.floor(change.i / CHUNK),
        Math.floor(change.j / CHUNK)
      );
      const stroke = Option.getOrElse(MutableHashMap.get(strokes, key), () => {
        const made = strokeOf();
        MutableHashMap.set(strokes, key, made);
        return made;
      });
      MutableHashMap.set(
        stroke[change.layer],
        indexOf(change.i, change.j),
        change.to
      );
    }
  }
  const coded = (
    points: MutableHashMap.MutableHashMap<number, number>,
    code: (index: number, value: number) => number
  ) =>
    Arr.map(Arr.fromIterable(points), ([index, value]) => code(index, value));
  const land = Arr.map(Arr.fromIterable(strokes), ([key, stroke]) => {
    const [cx, cz] = placeOf(key);
    return {
      _tag: "land",
      clears: coded(stroke.clear, (index, value) => index * 2 + value),
      cx,
      cz,
      lifts: coded(stroke.lift, (index, value) => index * 256 + value + 128),
      paints: coded(stroke.paint, (index, value) => index * 8 + value),
    } as const;
  });
  const things = Arr.flatMap(changes, (change) =>
    change._tag === "thing"
      ? [
          Option.match(change.to, {
            onNone: () =>
              ({
                _tag: "take",
                at: change.at,
                cx: change.cx,
                cz: change.cz,
              }) as const,
            onSome: (placed) =>
              ({
                _tag: "set",
                ...placed,
                cx: change.cx,
                cz: change.cz,
              }) as const,
          }),
        ]
      : []
  );
  return [...land, ...things];
}

/**
 * Lays one stored chunk of a world over the land (ADR 0050, W3): its lifts
 * and paints as the learner left them, its cleared plants read out of their
 * bitset, and its things. The chunk grows again from them the next time a
 * place in it is read.
 */
export function layChunk(
  land: Land,
  stored: {
    readonly clears: ArrayBuffer;
    readonly cx: number;
    readonly cz: number;
    readonly lifts: ArrayBuffer;
    readonly paints: ArrayBuffer;
    readonly things: readonly (typeof Placed.Type)[];
  }
) {
  const key = keyOf(stored.cx, stored.cz);
  const bits = new Uint8Array(stored.clears);
  const clears = new Uint8Array(POINTS);
  for (let point = 0; point < POINTS; point += 1) {
    clears[point] =
      Math.floor(bits[Math.floor(point / 8)] / 2 ** (point % 8)) % 2;
  }
  MutableHashMap.set(land.lifts, key, new Int8Array(stored.lifts.slice(0)));
  MutableHashMap.set(land.paints, key, new Uint8Array(stored.paints.slice(0)));
  MutableHashMap.set(land.clears, key, clears);
  MutableHashMap.set(land.things, key, stored.things);
  MutableHashMap.remove(land.chunks, key);
}
