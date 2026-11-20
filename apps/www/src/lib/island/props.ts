import {
  Array as Arr,
  MutableHashMap,
  Option,
  Record as Rec,
  Schema,
} from "effect";
import { keyOf } from "@/lib/island/land/chunk";
import type { Land } from "@/lib/island/land/ground";
import { heightAt, surfaceAt } from "@/lib/island/land/ground";
import { placeAt } from "@/lib/island/land/site";
import type { Loose } from "@/lib/island/loose";
import { KINDS, looseAt } from "@/lib/island/loose";
import { Fruit } from "@/lib/island/models/fruit";
import { unitOf } from "@/lib/island/noise";

/** How many loose fruit lie on the land at once; the oldest leaves when one more drops. */
export const FRUIT_CAP = 14;

/** What a tree drops when it is shaken: its fruit, where up the tree it hangs, in blocks over its foot, how far from the trunk it lands at most, and how many fall at most. */
const Drop = Schema.Struct({
  fruit: Fruit,
  height: Schema.Finite,
  most: Schema.Int,
  spread: Schema.Finite,
});

/** The fruit each tree drops, by the tree's kind, wild or set down; a kind left out bears none. */
const DROPS: Record<string, typeof Drop.Type> = {
  banana: { fruit: "banana", height: 1.9, most: 1, spread: 0.9 },
  mango: { fruit: "mango", height: 4.6, most: 2, spread: 2.4 },
  palm: { fruit: "coconut", height: 8.6, most: 2, spread: 1.2 },
  tree: { fruit: "mango", height: 4.6, most: 2, spread: 2.4 },
};

/**
 * The fruit a shaken tree drops (ADR 0050, W2), none from a tree that bears
 * none: one or two of its kind from where they hang, each a little out from
 * the trunk and moving on outward, placed by the land's seed and by how many
 * shakes came before, so nothing is drawn by chance.
 */
export function dropOf(
  seed: number,
  shakes: number,
  kind: string,
  foot: readonly [number, number, number]
): readonly Loose[] {
  return Option.match(Rec.get(DROPS, kind), {
    onNone: () => [],
    onSome: (drop) => {
      const count = 1 + Math.floor(unitOf(seed, shakes, 71, 0) * drop.most);
      return Arr.map(Arr.range(1, count), (nth) => {
        const angle = unitOf(seed, shakes, 72, nth) * Math.PI * 2;
        const out = drop.spread * (0.35 + unitOf(seed, shakes, 73, nth) * 0.65);
        return {
          ...looseAt(drop.fruit, `fruit-${shakes}-${nth}`, [
            foot[0] + Math.cos(angle) * out,
            foot[1] + drop.height,
            foot[2] + Math.sin(angle) * out,
          ]),
          speedX: Math.cos(angle) * 0.6,
          speedZ: Math.sin(angle) * 0.6,
        };
      });
    },
  });
}

/** Loose things with fresh fruit among them, the oldest fruit gone where there would be more than the land holds. */
export function gathered(
  loose: readonly Loose[],
  fresh: readonly Loose[]
): readonly Loose[] {
  const all = Arr.appendAll(loose, fresh);
  const extra =
    Arr.filter(all, (item) => item.kind !== "ball").length - FRUIT_CAP;
  return Arr.reduce(
    all,
    { kept: Arr.empty<Loose>(), left: extra },
    (so, item) =>
      item.kind !== "ball" && so.left > 0
        ? { kept: so.kept, left: so.left - 1 }
        : { kept: Arr.append(so.kept, item), left: so.left }
  ).kept;
}

/**
 * The loose things with the balls of the land about a chunk among them (ADR
 * 0050, W2): every ball the learner set down in the nine chunks about it is a
 * loose thing, new ones lying where they were set down and the ones already
 * loose left where they rolled, and a ball whose thing is gone, or far off,
 * goes too. Fruit stays as it is.
 */
export function withBalls(
  land: Land,
  loose: readonly Loose[],
  cx: number,
  cz: number
): readonly Loose[] {
  const balls = Arr.flatMap(Arr.range(0, 8), (slot) => {
    const [nx, nz] = [cx + (slot % 3) - 1, cz + Math.floor(slot / 3) - 1];
    return Arr.map(
      Arr.filter(
        Option.getOrElse(
          MutableHashMap.get(land.things, keyOf(nx, nz)),
          () => []
        ),
        (thing) => thing.kind === "ball"
      ),
      (thing) => {
        const key = `ball-${nx}-${nz}-${thing.at}`;
        const [x, z] = placeAt({ at: thing.at, cx: nx, cz: nz });
        return Option.getOrElse(
          Arr.findFirst(loose, (item) => item.key === key),
          () =>
            looseAt("ball", key, [
              x,
              Math.max(heightAt(land, x, z), surfaceAt(land, x, z)) +
                KINDS.ball.radius,
              z,
            ])
        );
      }
    );
  });
  return [...balls, ...Arr.filter(loose, (item) => item.kind !== "ball")];
}

/** How near a press must land to a loose thing's middle to touch it, in blocks. */
const TOUCH = 0.7;

/** Which loose thing a press at a place of the land touches, by its place in the list: the nearest within a hand's reach, none when the press touches none. */
export function touchedAt(loose: readonly Loose[], x: number, z: number) {
  return Arr.reduce(loose, Option.none<number>(), (best, item, index) => {
    const distance = Math.hypot(item.x - x, item.z - z);
    const nearest = Option.match(best, {
      onNone: () => TOUCH,
      onSome: (held) => Math.hypot(loose[held].x - x, loose[held].z - z),
    });
    return distance < nearest ? Option.some(index) : best;
  });
}

/**
 * The six numbers the painter draws a loose thing's body from: where its
 * model's origin lies, the way it faces, no gait, and how far it has tipped
 * forward as it rolled. A fruit's model is built about its middle; the ball's
 * stands on the ground, so its origin is swung about its middle with its
 * roll, and it turns on the spot as a ball does.
 */
export function bodyOf(item: Loose): readonly number[] {
  const pitch = -(item.roll % (Math.PI * 2));
  if (item.kind !== "ball") {
    return [item.x, item.y, item.z, item.heading, 0, pitch];
  }
  const radius = KINDS.ball.radius;
  return [
    item.x + radius * Math.sin(pitch) * Math.sin(item.heading),
    item.y - radius * Math.cos(pitch),
    item.z + radius * Math.sin(pitch) * Math.cos(item.heading),
    item.heading,
    0,
    pitch,
  ];
}
