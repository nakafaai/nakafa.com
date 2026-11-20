import type { Thing } from "@repo/backend/confect/island/things";
import {
  Array as Arr,
  MutableHashMap,
  Option,
  Order,
  Record as Rec,
  Result,
} from "effect";
import { CHUNK, keyOf } from "@/lib/island/land/chunk";
import type { Wild } from "@/lib/island/land/flora";
import { floraOf } from "@/lib/island/land/flora";
import type { Land } from "@/lib/island/land/ground";
import { coverAt, depthAt, heightAt } from "@/lib/island/land/ground";
import { placeAt, seatOf } from "@/lib/island/land/site";
import { meters } from "@/lib/island/models/parts";
import { thingSize } from "@/lib/island/models/things";
import { unitOf } from "@/lib/island/noise";

/** How many lamps light the ground at once. */
const LAMPS = 8;

/**
 * What glows after dusk (ADR 0050, W2), each where it glows on its model, in
 * meters from the model's foot with its front toward +z, and how brightly: a
 * lantern at its glass, a fire in its flames, a cottage's and a library's
 * front window, and the lighthouse's lantern room.
 */
const LIGHTS = {
  campfire: { at: [0, 0.4, 0], power: 1.2 },
  cottage: { at: [1.75, 1.75, 2.35], power: 0.8 },
  lantern: { at: [0, 2.4, 0], power: 1 },
  library: { at: [0, 1.8, 2.6], power: 0.8 },
  lighthouse: { at: [0, 12, 0], power: 1.6 },
} as const;

/** Where smoke rises from (ADR 0047, D33), in meters on its model: the top of a cottage's chimney, and a fire. */
const SMOKES = {
  campfire: [0, 0.7, 0],
  cottage: [1.5, 5.9, -0.8],
} as const;

/** The trees whose crowns let leaves go (ADR 0047, D41). */
const CROWNS = ["mango", "flame", "casuarina", "banana"] as const;

/** The tree each wild plant with such a crown is drawn as. */
const WILD_CROWNS: Partial<Record<Wild, (typeof CROWNS)[number]>> = {
  banana: "banana",
  flame: "flame",
  tree: "mango",
};

/**
 * How far from the origin each part of the scenery is read: in chunks for the
 * things that glow and smoke and for the trees that shed, and in blocks for
 * what hovers, with how far apart the hovering places are tried, how far
 * from one water or a wood shelters a firefly, and the most of each a painter
 * is handed.
 */
const REACH = {
  crowns: 240,
  hover: 42,
  most: 96,
  step: 3,
  things: 3,
  trees: 1,
  wet: 7,
} as const;

/** The share of a meadow's places a butterfly calls home, and of open grass by water or wood a firefly does. */
const SHARE = { butterfly: 0.3, firefly: 0.35 } as const;

/** The chunks within `reach` chunks of an origin's own, as their coordinates. */
function chunksAbout(origin: readonly [number, number], reach: number) {
  const side = reach * 2 + 1;
  return Arr.makeBy(
    side * side,
    (slot) =>
      [
        Math.floor(origin[0] / CHUNK) + (slot % side) - reach,
        Math.floor(origin[1] / CHUNK) + Math.floor(slot / side) - reach,
      ] as const
  );
}

/** Every thing set down about an origin, each with where it stands, the height of its foot and its turn in radians. */
function thingsAbout(land: Land, origin: readonly [number, number]) {
  return Arr.flatMap(chunksAbout(origin, REACH.things), ([cx, cz]) =>
    Arr.map(
      Option.getOrElse(
        MutableHashMap.get(land.things, keyOf(cx, cz)),
        () => []
      ),
      (thing) => {
        const [x, z] = placeAt({ at: thing.at, cx, cz });
        return {
          kind: thing.kind,
          x,
          y: seatOf(land, thing.kind, x, z, thing.turn),
          yaw: (thing.turn * Math.PI) / 2,
          z,
        };
      }
    )
  );
}

/** A point of a thing's model, given in meters from its foot, where it stands in the world. */
function pointOn(
  thing: ReturnType<typeof thingsAbout>[number],
  at: readonly [number, number, number]
) {
  const [across, up, deep] = [meters(at[0]), meters(at[1]), meters(at[2])];
  return [
    thing.x + across * Math.cos(thing.yaw) + deep * Math.sin(thing.yaw),
    thing.y + up,
    thing.z - across * Math.sin(thing.yaw) + deep * Math.cos(thing.yaw),
  ] as const;
}

/** A value of a table by a thing's kind, none for a kind the table leaves out. */
function ofKind<Value>(table: Readonly<Record<string, Value>>, kind: Thing) {
  return Option.fromNullishOr(table[kind]);
}

/**
 * The lamps that light the ground about an origin (ADR 0047, D36; ADR 0050,
 * W2): the nearest eight of the lanterns, the fires, the cottages' and
 * libraries' windows and the lighthouses' lantern rooms, four numbers each
 * (its place and how brightly it burns), zeros where fewer stand. The lamps
 * are read from the land itself; `revision` only tells a caller when to ask
 * again.
 */
export function lampsOf(
  land: Land,
  _revision: number,
  origin: readonly [number, number]
) {
  const lights = Arr.filterMap(thingsAbout(land, origin), (thing) =>
    Option.match(ofKind(LIGHTS, thing.kind), {
      onNone: () => Result.failVoid,
      onSome: (light) => {
        const [x, y, z] = pointOn(thing, light.at);
        return Result.succeed({
          away: Math.hypot(x - origin[0], z - origin[1]),
          lamp: [x, y, z, light.power],
        });
      },
    })
  );
  const nearest = Arr.take(
    Arr.sort(
      lights,
      Order.mapInput(
        Order.Number,
        (light: (typeof lights)[number]) => light.away
      )
    ),
    LAMPS
  );
  const lamps = new Float32Array(LAMPS * 4);
  lamps.set(Arr.flatMap(nearest, (light) => light.lamp));
  return lamps;
}

/** The dry places about an origin where something may hover, on a grid, each with what covers it and the two dice that pick a butterfly's and a firefly's home among them. */
function hoveringOf(land: Land, origin: readonly [number, number]) {
  const side = Math.floor((REACH.hover * 2) / REACH.step) + 1;
  const base = [
    Math.round(origin[0] / REACH.step) * REACH.step - REACH.hover,
    Math.round(origin[1] / REACH.step) * REACH.step - REACH.hover,
  ] as const;
  return Arr.filter(
    Arr.makeBy(side * side, (slot) => {
      const x = base[0] + (slot % side) * REACH.step;
      const z = base[1] + Math.floor(slot / side) * REACH.step;
      return {
        cover: coverAt(land, x, z),
        flutter: unitOf(land.seed + 71, x, 0, z),
        glow: unitOf(land.seed + 53, x, 0, z),
        x,
        z,
      };
    }),
    (spot) => depthAt(land, spot.x, spot.z) <= 0
  );
}

/** Whether water or a wood lies within a few blocks of a place, where fireflies gather. */
function isSheltered(land: Land, x: number, z: number) {
  return Arr.some(
    [
      [REACH.wet, 0],
      [-REACH.wet, 0],
      [0, REACH.wet],
      [0, -REACH.wet],
    ] as const,
    ([across, deep]) =>
      depthAt(land, x + across, z + deep) > 0 ||
      coverAt(land, x + across, z + deep) === "forest"
  );
}

/** Places as a run of numbers a painter reads, `lift` blocks over the ground, no more than it is handed at once. */
function hoverRun(
  land: Land,
  spots: ReturnType<typeof hoveringOf>,
  lift: number
) {
  return Float32Array.from(
    Arr.flatMap(Arr.take(spots, REACH.most), ({ x, z }) => [
      x,
      heightAt(land, x, z) + lift,
      z,
    ])
  );
}

/**
 * What the passes in the air start from about an origin (ADR 0047, D33, D36
 * and D41; ADR 0050, W9), in the layouts those passes read: `butterflies`,
 * three numbers each, over about one place in three of the meadow;
 * `fireflies`, three each, over open grass and meadow near water or a wood;
 * `chimneys`, three each, the tops of the cottages' chimneys and the fires;
 * and `crowns`, four each, the point under the crown of every broad tree,
 * wild or planted, and the height of the ground under it, where leaves fall
 * from. They are read from the land itself; `revision` only tells a caller
 * when to ask again.
 */
export function sceneryOf(
  land: Land,
  _revision: number,
  origin: readonly [number, number]
) {
  const things = thingsAbout(land, origin);
  const heights = Rec.fromEntries(
    Arr.map(CROWNS, (kind) => [kind, thingSize(kind).height] as const)
  );
  const wild = Arr.flatMap(chunksAbout(origin, REACH.trees), ([cx, cz]) =>
    Arr.flatMap(floraOf(land, cx, cz), (plant) =>
      Option.match(Option.fromNullishOr(WILD_CROWNS[plant.kind]), {
        onNone: () => [],
        onSome: (kind) => [{ kind, x: plant.x, y: plant.y, z: plant.z }],
      })
    )
  );
  const planted = Arr.flatMap(things, (thing) =>
    Option.match(
      Arr.findFirst(CROWNS, (kind) => kind === thing.kind),
      {
        onNone: () => [],
        onSome: (kind) => [{ kind, x: thing.x, y: thing.y, z: thing.z }],
      }
    )
  );
  const trees = [...wild, ...planted];
  const open = hoveringOf(land, origin);
  return {
    butterflies: hoverRun(
      land,
      Arr.filter(
        open,
        (spot) => spot.cover === "meadow" && spot.flutter < SHARE.butterfly
      ),
      0.9
    ),
    chimneys: Float32Array.from(
      Arr.flatMap(things, (thing) =>
        Option.match(ofKind(SMOKES, thing.kind), {
          onNone: () => [],
          onSome: (at) => [...pointOn(thing, at)],
        })
      )
    ),
    crowns: Float32Array.from(
      Arr.flatMap(Arr.take(trees, REACH.crowns), (tree) => [
        tree.x,
        tree.y + heights[tree.kind] * 0.45,
        tree.z,
        tree.y,
      ])
    ),
    fireflies: hoverRun(
      land,
      Arr.filter(
        open,
        (spot) =>
          (spot.cover === "grass" || spot.cover === "meadow") &&
          spot.glow < SHARE.firefly &&
          isSheltered(land, spot.x, spot.z)
      ),
      1
    ),
  };
}
