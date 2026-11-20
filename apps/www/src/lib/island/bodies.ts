import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option, Record as Rec } from "effect";
import { hunterAt } from "@/lib/island/hunt";
import type { Animal } from "@/lib/island/life";
import { groundOf } from "@/lib/island/life";
import { KIND, LOOK } from "@/lib/island/look";
import type { Model } from "@/lib/island/models/kinds";
import { BodyKind, modelKey } from "@/lib/island/models/kinds";
import { Swimmer } from "@/lib/island/models/ocean";
import { unitOf } from "@/lib/island/noise";
import { SCALE } from "@/lib/island/scale";
import type { Cells } from "@/lib/island/world";
import { SEA_LEVEL } from "@/lib/island/world";

/**
 * Numbers per drawn body: its place, the way it faces, how it moves where it
 * stands, and how far its nose tips up, in radians (D50). How it moves is
 * above zero for an animal, how high it bobs as it walks, and below zero for
 * a plant, minus one over its height in blocks, which is how far up it the
 * wind takes hold (ADR 0047, D32). The sun's shadow map casts every body's
 * shadow (D43).
 */
export const BODY_STRIDE = 6;

/** How far the whale swims from the island's middle, in cells: in deep water past the day's sea visitors, its flippers clear of them. */
const WHALE_ROUND = SPAN / 2 + 14;

/** How fast the whale swims, in cells a second. */
const WHALE_SPEED = 2.4;

/**
 * The open sea's big swimmers (ADR 0047, D24): each kind but the reef shark,
 * which hunts the bait ball on that ball's own round (D50), swims its own round,
 * `lane` cells from the island's middle, at its own depth and pace, a pod of
 * one or two abreast `gap` cells apart. Rounds never cross, so no two
 * swimmers meet: the near ones lie between the whale's flippers and the
 * isles' nearest reach, at least 57 cells out, and the far ones beyond the
 * isles' farthest, under 124 cells out (D23).
 */
const ROUNDS = {
  dolphin: { depth: 0.7, gap: 1.4, lane: 55.5, pod: 2, speed: 4.4 },
  hammerhead: { depth: 2.4, gap: 0, lane: 133, pod: 1, speed: 2.8 },
  orca: { depth: 1.3, gap: 3.2, lane: 127, pod: 2, speed: 3 },
  "tiger-shark": { depth: 2.2, gap: 0, lane: 137, pod: 1, speed: 2.2 },
  "whale-shark": { depth: 1.6, gap: 0, lane: 144, pod: 1, speed: 1.3 },
} as const;

/** How high a dolphin's leap carries it over the sea, in blocks. */
const LEAP = 1.4;

/**
 * The whale's breach (ADR 0047, D50), in seconds: once a `cycle`, the first
 * `first` seconds into the game, it dives,
 * turning its nose up, launches from `launch` blocks down so its middle
 * climbs `rise` blocks, flies free of the sea as gravity takes it, falls back
 * flat, and eases back to its round's depth.
 */
const BREACH = {
  cycle: 46,
  dive: 3,
  first: 20,
  launch: 4,
  recover: 4,
  rise: 6.5,
} as const;

/** Gravity, in blocks a second squared. */
const GRAVITY = 9.8 / SCALE.block;

/** How fast the whale leaves the sea, in blocks a second up, to climb its breach. */
const LAUNCH_SPEED = Math.sqrt(2 * GRAVITY * BREACH.rise);

/** How long the whale is in the air and the sea above its launch depth, in seconds. */
const FLIGHT = (2 * LAUNCH_SPEED) / GRAVITY;

/** How far the whale's nose may tip up and down in a breach, in radians: nearly upright as it leaves, nearly flat as it falls back. */
const TIP = { down: -0.5, up: 1.25 } as const;

/** A smooth step from 0 to 1. */
function eased(share: number) {
  return share * share * (3 - 2 * share);
}

/** The whale's height and its nose's tip at `time`, against `cruise`, the height its round's slow surfacing would hold. */
function breachOf(time: number, cruise: number) {
  const shifted = time + BREACH.cycle - BREACH.first;
  const within = shifted - Math.floor(shifted / BREACH.cycle) * BREACH.cycle;
  const low = SEA_LEVEL - BREACH.launch;
  if (within < BREACH.dive) {
    // It dips its nose first, then turns it up toward the light as it sinks to launch.
    const share = within / BREACH.dive;
    return {
      pitch:
        share < 0.5
          ? -0.3 * Math.sin(2 * Math.PI * share)
          : TIP.up * eased((share - 0.5) * 2),
      y: cruise + (low - cruise) * eased(share),
    };
  }
  if (within < BREACH.dive + FLIGHT) {
    const flown = within - BREACH.dive;
    const climb = LAUNCH_SPEED - GRAVITY * flown;
    return {
      pitch: Math.min(
        TIP.up,
        Math.max(TIP.down, Math.atan2(climb, WHALE_SPEED))
      ),
      y: low + LAUNCH_SPEED * flown - (GRAVITY * flown * flown) / 2,
    };
  }
  const share = (within - BREACH.dive - FLIGHT) / BREACH.recover;
  if (share < 1) {
    return {
      pitch: TIP.down * (1 - eased(share)),
      y: low + (cruise - low) * eased(share),
    };
  }
  return { pitch: 0, y: cruise };
}

/**
 * Where the whale swims at `time` seconds (ADR 0047, D21 and D50): a slow
 * round of the island in deep water, its back rising to break the sea and
 * sinking again, facing the way it swims; and now and then a breach, its
 * whole body leaving the sea nose first and falling back.
 */
export function whaleAt(time: number) {
  const angle = (time * WHALE_SPEED) / WHALE_ROUND;
  const cruise = SEA_LEVEL + 0.1 - 0.9 * (0.5 + 0.5 * Math.sin(time * 0.35));
  const breach = breachOf(time, cruise);
  return {
    pitch: breach.pitch,
    x: SPAN / 2 + Math.cos(angle) * WHALE_ROUND,
    y: breach.y,
    yaw: Math.atan2(-Math.sin(angle), Math.cos(angle)),
    z: SPAN / 2 + Math.sin(angle) * WHALE_ROUND,
  };
}

/** The height a body stands at in a column: on top of the ground, or a little sunk into water. */
function standingAt(cells: Cells, x: number, z: number) {
  return Option.match(groundOf(cells, Math.floor(x), Math.floor(z)), {
    onNone: () => SEA_LEVEL,
    onSome: ({ block, y }) =>
      LOOK.kinds[block] === KIND.liquid ? y + 1 - 0.2 : y + 1,
  });
}

/** One animal as a drawn body: on its ground, facing its goal, bobbing while it walks. */
function animalBody(cells: Cells, animal: Animal) {
  const [dx, dz] = [animal.tx - animal.x, animal.tz - animal.z];
  const heading = Math.hypot(dx, dz) > 0.05;
  const walking = animal.rest <= 0 && heading;
  const y = standingAt(cells, animal.x, animal.z);
  return [
    animal.x,
    y,
    animal.z,
    // At rest with nowhere to go, each animal keeps a heading of its own instead of all facing one way.
    heading
      ? Math.atan2(dx, dz)
      : (animal.x * 7.3 + animal.z * 3.1) % (2 * Math.PI),
    walking ? 0.06 : 0,
    0,
  ];
}

/**
 * Every body of the island's own to draw at `time` seconds, by kind (ADR
 * 0047, D21): each animal of the herd and the learner's fox on its own
 * ground, facing where it goes, and the whale on its round. Each kind comes
 * with its bodies as one run of numbers, `BODY_STRIDE` a body, for the painter
 * to draw them all at once.
 */
export function bodiesOf(cells: Cells, herd: readonly Animal[], time: number) {
  const whale = whaleAt(time);
  return Arr.map(BodyKind.literals, (kind) => {
    const own =
      kind === "whale"
        ? [[whale.x, whale.y, whale.z, whale.yaw, 0, whale.pitch]]
        : Arr.map(
            Arr.filter(herd, (animal) => animal.kind === kind),
            (animal) => animalBody(cells, animal)
          );
    const model = { _tag: "body", kind } as const;
    return [model, Float32Array.from(Arr.flatten(own))] as const;
  });
}

/** One dolphin of a pod at `time`: its leap's height over its depth and the tip of its nose, rising nose up and diving nose down. */
function leapOf(depth: number, speed: number, member: number, time: number) {
  const phase = time * 0.9 + member * 1.3;
  const rise = Math.sin(phase);
  const height = depth + LEAP;
  if (rise <= 0) {
    return { lift: 0, pitch: 0 };
  }
  const lift = rise * height;
  const climb = Math.cos(phase) * height * 0.9;
  return {
    lift,
    pitch: Math.atan2(climb, speed) * Math.min(1, lift / 0.4),
  };
}

/** One big swimmer of a pod on its round at `time`. */
function swimmerPlace(
  kind: keyof typeof ROUNDS,
  start: number,
  member: number,
  time: number
) {
  const round = ROUNDS[kind];
  const lane = round.lane + (member - (round.pod - 1) / 2) * round.gap;
  const angle = start + (time * round.speed) / round.lane - member * 0.02;
  const leap =
    kind === "dolphin"
      ? leapOf(round.depth, round.speed, member, time)
      : { lift: 0, pitch: 0 };
  return [
    SPAN / 2 + Math.cos(angle) * lane,
    SEA_LEVEL - round.depth + leap.lift,
    SPAN / 2 + Math.sin(angle) * lane,
    Math.atan2(-Math.sin(angle), Math.cos(angle)),
    0,
    leap.pitch,
  ];
}

/**
 * Where each big swimmer of the open sea is at `time` seconds (ADR 0047,
 * D24 and D50): every kind on its own round from a start the island's seed
 * picks, each member of a pod a little across and behind the one before,
 * facing the way it swims. A dolphin now and then leaps clear of the sea,
 * nose up as it rises and down as it dives; the reef shark hunts the bait
 * ball instead of swimming a round; the others keep under the sea.
 */
export function seaBodies(seed: number, time: number) {
  return Arr.map(Swimmer.literals, (kind, order) => {
    const start = unitOf(seed + 31, order, 0, 0) * Math.PI * 2;
    const hunter = hunterAt(seed, time);
    const own =
      kind === "reef-shark"
        ? [[hunter.x, hunter.y, hunter.z, hunter.yaw, 0, 0]]
        : Arr.makeBy(ROUNDS[kind].pod, (member) =>
            swimmerPlace(kind, start, member, time)
          );
    const model = { _tag: "swimmer", kind } as const;
    return [model, Float32Array.from(Arr.flatten(own))] as const;
  });
}

/**
 * Bodies with every model once (ADR 0047, D50): a model that comes in more
 * than one run, such as a reef resident the day also brings as a visitor,
 * has its runs joined, first to last, in the order they came.
 */
export function joined(bodies: readonly (readonly [Model, Float32Array])[]) {
  const groups = Arr.groupBy(bodies, ([model]) => modelKey(model));
  return Arr.map(Rec.values(groups), (group) => {
    // Most models come once; their runs pass through untouched, so a frame copies only what it must.
    if (group.length === 1) {
      return Arr.headNonEmpty(group);
    }
    const [model] = Arr.headNonEmpty(group);
    const places = Arr.flatMap(group, ([, data]) => Array.from(data));
    return [model, Float32Array.from(places)] as const;
  });
}
