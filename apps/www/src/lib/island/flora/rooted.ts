import type { Placed } from "@repo/backend/confect/island/chunk";
import type { Thing } from "@repo/backend/confect/island/things";
import {
  Array as Arr,
  MutableHashMap,
  MutableRef,
  Option,
  Order,
  Record as Rec,
} from "effect";
import { standingOf } from "@/lib/island/blockers";
import { joined } from "@/lib/island/bodies";
import type { Blocker } from "@/lib/island/collide";
import { CHUNK, keyOf } from "@/lib/island/land/chunk";
import type { Wild } from "@/lib/island/land/flora";
import { floraOf } from "@/lib/island/land/flora";
import type { Land } from "@/lib/island/land/ground";
import { placeAt, seatOf } from "@/lib/island/land/site";
import type { Model } from "@/lib/island/models/kinds";
import { modelKey } from "@/lib/island/models/kinds";
import type { ReefKind } from "@/lib/island/models/reef";
import { LOOKS } from "@/lib/island/models/reef";
import { THING_LOOKS, thingSize } from "@/lib/island/models/things";
import { hashOf } from "@/lib/island/noise";

/** The thing model each wild plant of the land is drawn as (ADR 0050, W1 and W2): a wild tree is a mango. */
const WILDS: Partial<Record<Wild, Thing>> = {
  banana: "banana",
  bush: "bush",
  flame: "flame",
  palm: "palm",
  pine: "pine",
  reed: "reed",
  rocks: "rocks",
  tree: "mango",
};

/** The reef model each wild water plant is drawn as (ADR 0047, D50). */
const REEFS: Partial<Record<Wild, ReefKind>> = {
  brain: "brain",
  lily: "lily",
  seagrass: "seagrass",
};

/** The forms a wild coral takes, picked by its place: staghorn, a table, a sea fan, a sponge or an anemone. */
const CORALS = ["branching", "table", "fan", "sponge", "anemone"] as const;

/** The kinds the wind moves (ADR 0047, D32): what grows on land. Rock, timber and what stands under water keep still. */
const SWAYING: readonly Thing[] = [
  "mango",
  "flame",
  "casuarina",
  "palm",
  "banana",
  "pine",
  "bush",
  "reed",
  "sunflower",
  "flowerbed",
];

/** How high and how wide a reef plant counts as for a ray that looks for it, in blocks. */
const REEF_SIZE = { height: 0.7, radius: 0.5 } as const;

/** How many chunks either way of the anchor's chunk are drawn, how many are remembered, and how many are read anew in one frame, so reading new land never stalls it. */
const REACH = { drawn: 3, each: 3, kept: 6 } as const;

/** A chunk nobody set a thing in. */
const NOTHING: readonly (typeof Placed.Type)[] = [];

/** Each thing's height and the reach of its widest side from its middle, measured from its model once. */
const sizes = MutableHashMap.empty<
  Thing,
  { readonly height: number; readonly radius: number }
>();

/** How high a thing stands and how far it reaches from its middle, in blocks. */
function sizeOf(kind: Thing) {
  return Option.getOrElse(MutableHashMap.get(sizes, kind), () => {
    const size = thingSize(kind);
    const measured = {
      height: size.height,
      radius: Math.max(size.width, size.depth) / 2,
    };
    MutableHashMap.set(sizes, kind, measured);
    return measured;
  });
}

/** A thing's model with the look its place gives it, so neighbours of one kind differ. */
function thingModel(kind: Thing, dice: number): Model {
  return { _tag: "thing", kind, look: dice % THING_LOOKS[kind] };
}

/** The model a wild plant is drawn as, its look and a coral's form picked by its place. */
export function wildModel(kind: Wild, dice: number): Model {
  const reef = Option.map(
    Option.fromNullishOr(REEFS[kind]),
    (found): Model => ({ _tag: "reef", kind: found, look: dice % LOOKS })
  );
  const thing = Option.map(Option.fromNullishOr(WILDS[kind]), (found) =>
    thingModel(found, dice)
  );
  return Option.getOrElse(
    Option.orElse(reef, () => thing),
    (): Model => ({
      _tag: "reef",
      kind: CORALS[dice % CORALS.length],
      look: Math.floor(dice / CORALS.length) % LOOKS,
    })
  );
}

/** How a model answers the wind as a body's fifth number: minus one over its height for what sways, nothing for what keeps still. */
function swayOf(model: Model, height: number) {
  return model._tag === "thing" && Arr.contains(SWAYING, model.kind)
    ? -1 / Math.max(0.5, height)
    : 0;
}

/** One wild plant of a chunk as it stands and is drawn. */
function wildRoot(land: Land, plant: ReturnType<typeof floraOf>[number]) {
  const model = wildModel(
    plant.kind,
    hashOf(land.seed + 77, plant.i, 0, plant.j)
  );
  const size = model._tag === "thing" ? sizeOf(model.kind) : { ...REEF_SIZE };
  return {
    ...size,
    model,
    origin: {
      _tag: "wild",
      i: plant.i,
      j: plant.j,
      kind: plant.kind,
    } as const,
    x: plant.x,
    y: plant.y,
    yaw: plant.turn,
    z: plant.z,
  };
}

/** One thing the learner set down in a chunk as it stands and is drawn. */
function thingRoot(
  land: Land,
  thing: typeof Placed.Type,
  cx: number,
  cz: number
) {
  const [x, z] = placeAt({ at: thing.at, cx, cz });
  return {
    ...sizeOf(thing.kind),
    model: thingModel(thing.kind, hashOf(land.seed + 78, thing.at, cx, cz)),
    origin: { _tag: "thing", at: thing.at, cx, cz, kind: thing.kind } as const,
    x,
    y: seatOf(land, thing.kind, x, z, thing.turn),
    yaw: (thing.turn * Math.PI) / 2,
    z,
  };
}

/** One number for all a typed store of a chunk holds, so a change to it shows without comparing every point. */
function sumOf(store: Option.Option<Int8Array | Uint8Array>) {
  return Option.match(store, {
    onNone: () => 0,
    onSome: (values) => {
      let sum = 1;
      for (const value of values) {
        sum = (sum * 33 + value + 129) % 1_000_003;
      }
      return sum;
    },
  });
}

/** One number for what the learner changed in a chunk and the eight around it, whose ground a plant at its edge also stands on. */
function stampOf(land: Land, cx: number, cz: number) {
  return Arr.reduce(Arr.range(0, 8), 0, (stamp, slot) => {
    const key = keyOf(cx + (slot % 3) - 1, cz + Math.floor(slot / 3) - 1);
    return (
      stamp +
      (slot + 1) *
        (sumOf(MutableHashMap.get(land.lifts, key)) * 3 +
          sumOf(MutableHashMap.get(land.paints, key)) * 5 +
          sumOf(MutableHashMap.get(land.clears, key)) * 7)
    );
  });
}

/** The things the learner set down in a chunk. */
function thingsOf(land: Land, cx: number, cz: number) {
  return Option.getOrElse(
    MutableHashMap.get(land.things, keyOf(cx, cz)),
    () => NOTHING
  );
}

/**
 * Everything that stands in one chunk (ADR 0050, W2 and W9): each wild plant
 * and each thing with where it stands, its model and its size, and all of
 * them as bodies, one run of six numbers a body for each model. A plant gives
 * to the wind; a rock, a building and what grows under water do not.
 */
function rootOf(land: Land, cx: number, cz: number) {
  const things = thingsOf(land, cx, cz);
  const standing = [
    ...Arr.map(floraOf(land, cx, cz), (plant) => wildRoot(land, plant)),
    ...Arr.map(things, (thing) => thingRoot(land, thing, cx, cz)),
  ];
  // A ball is drawn where it rolled to, by the loose things, and not where it was set down.
  const still = Arr.filter(
    standing,
    ({ model }) => !(model._tag === "thing" && model.kind === "ball")
  );
  const bodies = Arr.map(
    Rec.values(Arr.groupBy(still, (root) => modelKey(root.model))),
    (group) =>
      [
        Arr.headNonEmpty(group).model,
        Float32Array.from(
          Arr.flatMap(group, (root) => [
            root.x,
            root.y,
            root.z,
            root.yaw,
            swayOf(root.model, root.height),
            0,
          ])
        ),
      ] as const
  );
  return {
    blockers: MutableRef.make(Option.none<readonly Blocker[]>()),
    bodies,
    cx,
    cz,
    stamp: stampOf(land, cx, cz),
    standing,
    things,
  };
}
export type Root = ReturnType<typeof rootOf>;

/**
 * What a world remembers of what stands on its land (ADR 0050, W9), by chunk:
 * each chunk is read once and kept until the learner changes it or the camera
 * leaves it behind, and the bodies of the chunks in sight are kept joined, one
 * list a model, until one of them changes.
 */
export function rootsOf() {
  return {
    chunks: MutableHashMap.empty<number, Root>(),
    drawn: MutableRef.make({
      bodies: Arr.empty<readonly [Model, Float32Array]>(),
      key: "",
    }),
    revision: MutableRef.make(Number.NaN),
    version: MutableRef.make(0),
  };
}
export type Roots = ReturnType<typeof rootsOf>;

/** What stands in one chunk, read the first time it is asked for. */
export function rootAt(roots: Roots, land: Land, cx: number, cz: number) {
  const key = keyOf(cx, cz);
  return Option.getOrElse(MutableHashMap.get(roots.chunks, key), () => {
    const root = rootOf(land, cx, cz);
    MutableHashMap.set(roots.chunks, key, root);
    MutableRef.update(roots.version, (version) => version + 1);
    return root;
  });
}

/** What a walker cannot pass in one chunk (ADR 0047, D22), read the first time a walker asks. */
function blockersOf(roots: Roots, land: Land, cx: number, cz: number) {
  const root = rootAt(roots, land, cx, cz);
  return Option.getOrElse(MutableRef.get(root.blockers), () => {
    const { blockers } = standingOf(land, cx, cz);
    MutableRef.set(root.blockers, Option.some(blockers));
    return blockers;
  });
}

/** What a walker cannot pass within `reach` blocks of a place, from every chunk that reaches into it. */
export function blockersAbout(
  roots: Roots,
  land: Land,
  place: readonly [number, number],
  reach: number
) {
  const from = [
    Math.floor((place[0] - reach) / CHUNK),
    Math.floor((place[1] - reach) / CHUNK),
  ] as const;
  const to = [
    Math.floor((place[0] + reach) / CHUNK),
    Math.floor((place[1] + reach) / CHUNK),
  ] as const;
  // Most places lie well inside one chunk, whose own list answers without a copy.
  if (from[0] === to[0] && from[1] === to[1]) {
    return blockersOf(roots, land, from[0], from[1]);
  }
  return Arr.flatMap(Arr.range(from[0], to[0]), (cx) =>
    Arr.flatMap(Arr.range(from[1], to[1]), (cz) =>
      blockersOf(roots, land, cx, cz)
    )
  );
}

/** Forgets every remembered chunk a test fails, and says so by a new version. */
function forget(roots: Roots, stale: (root: Root) => boolean) {
  const gone = Arr.filter(Arr.fromIterable(roots.chunks), ([, root]) =>
    stale(root)
  );
  for (const [key] of gone) {
    MutableHashMap.remove(roots.chunks, key);
  }
  if (gone.length > 0) {
    MutableRef.update(roots.version, (version) => version + 1);
  }
}

/**
 * Every wild plant and every thing in sight of the anchor as bodies, each
 * model once with all its bodies (ADR 0050, W9 and W10). A chunk is read
 * again only when `revision` rose and what the learner changed in or beside
 * it differs, chunks far behind the anchor are forgotten, a few of the
 * chunks not read yet are read each frame, the nearest first, and the joined
 * lists are the same arrays frame after frame until a chunk in sight
 * changes, so a painter that holds them has nothing to send again.
 */
export function rootedBodies(
  roots: Roots,
  land: Land,
  anchor: readonly [number, number],
  revision: number
) {
  const cx = Math.floor(anchor[0] / CHUNK);
  const cz = Math.floor(anchor[1] / CHUNK);
  if (MutableRef.get(roots.revision) !== revision) {
    MutableRef.set(roots.revision, revision);
    forget(
      roots,
      (root) =>
        root.things !== thingsOf(land, root.cx, root.cz) ||
        root.stamp !== stampOf(land, root.cx, root.cz)
    );
  }
  forget(
    roots,
    (root) =>
      Math.max(Math.abs(root.cx - cx), Math.abs(root.cz - cz)) > REACH.kept
  );
  const side = REACH.drawn * 2 + 1;
  const wanted = Arr.makeBy(
    side * side,
    (slot) =>
      [
        cx + (slot % side) - REACH.drawn,
        cz + Math.floor(slot / side) - REACH.drawn,
      ] as const
  );
  const unread = Arr.sort(
    Arr.filter(
      wanted,
      ([x, z]) => !MutableHashMap.has(roots.chunks, keyOf(x, z))
    ),
    Order.mapInput(Order.Number, ([x, z]: readonly [number, number]) =>
      Math.hypot(x - cx, z - cz)
    )
  );
  for (const [x, z] of Arr.take(unread, REACH.each)) {
    rootAt(roots, land, x, z);
  }
  const near = Arr.getSomes(
    Arr.map(wanted, ([x, z]) => MutableHashMap.get(roots.chunks, keyOf(x, z)))
  );
  const key = `${MutableRef.get(roots.version)}:${cx}:${cz}`;
  const drawn = MutableRef.get(roots.drawn);
  if (drawn.key === key) {
    return drawn.bodies;
  }
  const bodies = joined(Arr.flatMap(near, (root) => root.bodies));
  MutableRef.set(roots.drawn, { bodies, key });
  return bodies;
}
