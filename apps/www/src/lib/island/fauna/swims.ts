import { Array as Arr, Match, Option, Record as Rec, Schema } from "effect";
import type { Dice } from "@/lib/island/fauna/cast";
import type { Survey } from "@/lib/island/fauna/habitat";
import { HUNT_REACH, Hunt, hunterAt } from "@/lib/island/hunt";
import type { Land } from "@/lib/island/land/ground";
import { depthAt } from "@/lib/island/land/ground";
import { SEA } from "@/lib/island/land/relief";
import type { Model } from "@/lib/island/models/kinds";
import { unitOf } from "@/lib/island/noise";
import { SCALE } from "@/lib/island/scale";

/** How fast the whale swims, in blocks a second. */
const WHALE_SPEED = 2.4;

/**
 * The open sea's big swimmers that keep a round (ADR 0047, D24): each kind at
 * its own depth and pace, a pod of `pod` abreast `gap` blocks apart. The reef
 * shark keeps none: it hunts the bait ball (D50).
 */
const ROUNDS = {
  dolphin: { depth: 0.7, gap: 1.4, pod: 3, speed: 4.4 },
  hammerhead: { depth: 2.4, gap: 0, pod: 1, speed: 2.8 },
  orca: { depth: 1.3, gap: 3.2, pod: 2, speed: 3 },
  "tiger-shark": { depth: 2.2, gap: 0, pod: 1, speed: 2.2 },
  "whale-shark": { depth: 1.6, gap: 0, pod: 1, speed: 1.3 },
} as const;

/** The big swimmers that keep a round. */
const Rover = Schema.Literals(Rec.keys(ROUNDS));
type Rover = typeof Rover.Type;

/**
 * One big swimmer of the open sea, or a pod of them (ADR 0050, W9): the
 * humpback, a kind that keeps a round, or the reef shark on its hunt. A round
 * lies `radius` blocks about a place of deep water, and `start` is where on
 * it the swimmer begins, in radians.
 */
const Swim = Schema.Union([
  Schema.TaggedStruct("whale", {
    radius: Schema.Finite,
    start: Schema.Finite,
    x: Schema.Finite,
    z: Schema.Finite,
  }),
  Schema.TaggedStruct("pod", {
    kind: Rover,
    radius: Schema.Finite,
    start: Schema.Finite,
    x: Schema.Finite,
    z: Schema.Finite,
  }),
  Schema.TaggedStruct("hunter", { hunt: Hunt }),
]);
type Swim = typeof Swim.Type;

/** How deep the sea must stand along a swimmer's round, in blocks: its own depth and room for its belly, and for the whale the dive it breaches from. */
export function draughtOf(kind: Rover | "whale") {
  return kind === "whale" ? 6 : ROUNDS[kind].depth + 1.2;
}

/** The rounds a big swimmer may keep about a place, widest first, in blocks. */
const LANES = [20, 14, 9] as const;

/** How far a bait ball's middle drifts from the place its hunt keeps about, how deep it lies, and how deep the sea must stand for it, in blocks. */
const BALL = { depth: 2, draught: 3.4, lane: 5 } as const;

/**
 * Who a place of the open sea may hold and how often (ADR 0047, D24): each
 * kind with the share of the dice up to which it is picked. What no share
 * takes is the hunt.
 */
const SHARES = [
  ["whale", 0.1],
  ["dolphin", 0.34],
  ["orca", 0.48],
  ["tiger-shark", 0.58],
  ["hammerhead", 0.68],
  ["whale-shark", 0.76],
] as const;

/** Whether the sea stands at least `draught` deep all along a round of `radius` blocks about a place and `margin` to either side of it, so nothing on it swims through the ground. */
function isOpen(
  land: Land,
  round: { readonly radius: number; readonly x: number; readonly z: number },
  margin: number,
  draught: number
) {
  return Arr.every(Arr.range(0, 23), (probe) => {
    const angle = (Math.floor(probe / 2) / 12) * Math.PI * 2;
    const reach = round.radius + (probe % 2 === 0 ? margin : -margin);
    return (
      depthAt(
        land,
        round.x + Math.cos(angle) * reach,
        round.z + Math.sin(angle) * reach
      ) >= draught
    );
  });
}

/** The swimmer of a kind about one place of the sea, on the widest round the sea there leaves it, none where it is too shallow or too narrow. */
function swimAt(
  land: Land,
  kind: Rover | "hunter" | "whale",
  at: { readonly start: number; readonly x: number; readonly z: number }
): Option.Option<Swim> {
  if (kind === "hunter") {
    const round = { radius: BALL.lane, x: at.x, z: at.z };
    return isOpen(land, round, HUNT_REACH, BALL.draught)
      ? Option.some({
          _tag: "hunter",
          hunt: {
            lane: BALL.lane,
            seed: Math.floor(at.start * 1000),
            x: at.x,
            y: SEA - BALL.depth,
            z: at.z,
          },
        })
      : Option.none();
  }
  const margin = kind === "whale" ? 3 : ROUNDS[kind].gap + 1;
  return Option.map(
    Arr.findFirst(LANES, (radius) =>
      isOpen(land, { radius, x: at.x, z: at.z }, margin, draughtOf(kind))
    ),
    (radius): Swim =>
      kind === "whale"
        ? { _tag: "whale", radius, ...at }
        : { _tag: "pod", kind, radius, ...at }
  );
}

/**
 * The big swimmer one cell of open sea holds (ADR 0050, W9), by the seed and
 * the cell, so the same bay always holds the same one: a humpback, a pod of
 * dolphins or orcas, a shark, or a reef shark hunting its bait ball, about the
 * first of the cell's places of deep water that leaves it a round. A cell
 * with too little deep water holds none.
 */
export function swimsOf(
  land: Land,
  spots: Survey["sea"],
  dice: Dice
): readonly Swim[] {
  if (spots.length < 24) {
    return [];
  }
  const roll = unitOf(dice.seed + 501, dice.gx, 1, dice.gz);
  const start = unitOf(dice.seed + 502, dice.gx, 2, dice.gz) * Math.PI * 2;
  const kind = Option.match(
    Arr.findFirst(SHARES, ([, upTo]) => roll < upTo),
    { onNone: () => "hunter" as const, onSome: ([found]) => found }
  );
  return Arr.take(
    Arr.getSomes(
      Arr.map(Arr.take(spots, 4), (spot) =>
        swimAt(land, kind, { start, x: spot.x, z: spot.z })
      )
    ),
    1
  );
}

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

/** The whale's height and its nose's tip `within` seconds into its breach's cycle, against `cruise`, the height its round's slow surfacing would hold. */
function breachOf(within: number, cruise: number) {
  const low = SEA - BREACH.launch;
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
 * Where a whale swims at `time` seconds (ADR 0047, D21 and D50): a slow
 * round in deep water, its back rising to break the sea and sinking again,
 * facing the way it swims; and now and then a breach, its whole body leaving
 * the sea nose first and falling back. Each whale breaches at a moment of its
 * own, set by where its round begins.
 */
export function whaleAt(whale: Extract<Swim, { _tag: "whale" }>, time: number) {
  const angle = whale.start + (time * WHALE_SPEED) / whale.radius;
  const cruise = SEA + 0.1 - 0.9 * (0.5 + 0.5 * Math.sin(time * 0.35));
  const shifted = time + BREACH.cycle - BREACH.first + whale.start * 7;
  const breach = breachOf(
    shifted - Math.floor(shifted / BREACH.cycle) * BREACH.cycle,
    cruise
  );
  return {
    pitch: breach.pitch,
    x: whale.x + Math.cos(angle) * whale.radius,
    y: breach.y,
    yaw: Math.atan2(-Math.sin(angle), Math.cos(angle)),
    z: whale.z + Math.sin(angle) * whale.radius,
  };
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

/** One big swimmer of a pod on its round at `time`: each member a little across and behind the one before, a dolphin now and then leaping clear of the sea. */
function roverPlace(
  pod: Extract<Swim, { _tag: "pod" }>,
  member: number,
  time: number
) {
  const round = ROUNDS[pod.kind];
  const lane = pod.radius + (member - (round.pod - 1) / 2) * round.gap;
  const angle = pod.start + (time * round.speed) / pod.radius - member * 0.08;
  const leap =
    pod.kind === "dolphin"
      ? leapOf(round.depth, round.speed, member, time + pod.start * 3)
      : { lift: 0, pitch: 0 };
  return [
    pod.x + Math.cos(angle) * lane,
    SEA - round.depth + leap.lift,
    pod.z + Math.sin(angle) * lane,
    Math.atan2(-Math.sin(angle), Math.cos(angle)),
    0,
    leap.pitch,
  ];
}

/**
 * Where each big swimmer of the open sea is at `time` seconds (ADR 0047,
 * D24 and D50), each with its model: a whale on its round and in its breach,
 * a pod on its round facing the way it swims, and the reef shark circling and
 * charging its bait ball.
 */
export function swimBodies(swims: readonly Swim[], time: number) {
  return Arr.map(swims, (swim) =>
    Match.valueTags(swim, {
      hunter: ({ hunt }) => {
        const hunter = hunterAt(hunt, time);
        const model: Model = { _tag: "swimmer", kind: "reef-shark" };
        return [
          model,
          Float32Array.of(hunter.x, hunter.y, hunter.z, hunter.yaw, 0, 0),
        ] as const;
      },
      pod: (pod) => {
        const model: Model = { _tag: "swimmer", kind: pod.kind };
        return [
          model,
          Float32Array.from(
            Arr.flatten(
              Arr.makeBy(ROUNDS[pod.kind].pod, (member) =>
                roverPlace(pod, member, time)
              )
            )
          ),
        ] as const;
      },
      whale: (whale) => {
        const at = whaleAt(whale, time);
        const model: Model = { _tag: "body", kind: "whale" };
        return [
          model,
          Float32Array.of(at.x, at.y, at.z, at.yaw, 0, at.pitch),
        ] as const;
      },
    })
  );
}
