import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option } from "effect";
import { type Animal, groundOf } from "@/lib/island/life";
import { KIND, LOOK } from "@/lib/island/look";
import { BodyKind } from "@/lib/island/models/kinds";
import { Swimmer } from "@/lib/island/models/ocean";
import { unitOf } from "@/lib/island/noise";
import { type Cells, SEA_LEVEL } from "@/lib/island/world";

/** Numbers per drawn body: its place, the way it faces, how high it bobs as it walks, and the height of the ground its shadow falls on. */
export const BODY_STRIDE = 6;

/** The shadow ground of a body that casts none: one in the water or over it. */
export const NO_SHADOW = -1;

/** How far the whale swims from the island's middle, in cells: in deep water past the day's sea visitors, its flippers clear of them. */
const WHALE_ROUND = SPAN / 2 + 14;

/** How fast the whale swims, in cells a second. */
const WHALE_SPEED = 2.4;

/**
 * The open sea's big swimmers (ADR 0047, D24): each kind swims its own round,
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
  "reef-shark": { depth: 1.8, gap: 0, lane: 52.5, pod: 1, speed: 2.6 },
  "tiger-shark": { depth: 2.2, gap: 0, lane: 137, pod: 1, speed: 2.2 },
  "whale-shark": { depth: 1.6, gap: 0, lane: 144, pod: 1, speed: 1.3 },
} as const;

/** How high a dolphin's leap carries it over the sea, in blocks. */
const LEAP = 1.4;

/**
 * Where the whale swims at `time` seconds (ADR 0047, D21): a slow round of
 * the island in deep water, its back rising to break the sea and sinking
 * again, facing the way it swims.
 */
export function whaleAt(time: number) {
  const angle = (time * WHALE_SPEED) / WHALE_ROUND;
  return {
    x: SPAN / 2 + Math.cos(angle) * WHALE_ROUND,
    y: SEA_LEVEL + 0.1 - 0.9 * (0.5 + 0.5 * Math.sin(time * 0.35)),
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

/** One animal as a drawn body: on its ground, facing its goal, bobbing while it walks, its shadow at its feet. */
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
    y,
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
        ? [[whale.x, whale.y, whale.z, whale.yaw, 0, NO_SHADOW]]
        : Arr.map(
            Arr.filter(herd, (animal) => animal.kind === kind),
            (animal) => animalBody(cells, animal)
          );
    const model = { _tag: "body", kind } as const;
    return [model, Float32Array.from(Arr.flatten(own))] as const;
  });
}

/**
 * Where each big swimmer of the open sea is at `time` seconds (ADR 0047,
 * D24): every kind on its own round from a start the island's seed picks,
 * each member of a pod a little across and behind the one before, facing the
 * way it swims. A dolphin now and then leaps clear of the sea; the others
 * keep under it and cast no shadow.
 */
export function seaBodies(seed: number, time: number) {
  return Arr.map(Swimmer.literals, (kind, order) => {
    const round = ROUNDS[kind];
    const start = unitOf(seed + 31, order, 0, 0) * Math.PI * 2;
    const own = Arr.makeBy(round.pod, (member) => {
      const lane = round.lane + (member - (round.pod - 1) / 2) * round.gap;
      const angle = start + (time * round.speed) / round.lane - member * 0.02;
      const leap =
        kind === "dolphin"
          ? Math.max(0, Math.sin(time * 0.9 + member * 1.3)) *
            (round.depth + LEAP)
          : 0;
      return [
        SPAN / 2 + Math.cos(angle) * lane,
        SEA_LEVEL - round.depth + leap,
        SPAN / 2 + Math.sin(angle) * lane,
        Math.atan2(-Math.sin(angle), Math.cos(angle)),
        0,
        NO_SHADOW,
      ];
    });
    const model = { _tag: "swimmer", kind } as const;
    return [model, Float32Array.from(Arr.flatten(own))] as const;
  });
}
