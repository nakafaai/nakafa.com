import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option } from "effect";
import { type Animal, groundOf } from "@/lib/island/life";
import { KIND, LOOK } from "@/lib/island/look";
import { BodyKind } from "@/lib/island/models/kinds";
import { type Cells, SEA_LEVEL } from "@/lib/island/world";

/** Numbers per drawn body: its place, the way it faces, and how high it bobs as it walks. */
export const BODY_STRIDE = 5;

/** How far the whale swims from the island's middle, in cells: past the shore, in deep water. */
const WHALE_ROUND = SPAN / 2 + 12;

/** How fast the whale swims, in cells a second. */
const WHALE_SPEED = 2.4;

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

/** One animal as a drawn body: on its ground, facing its goal, bobbing while it walks. */
function animalBody(cells: Cells, animal: Animal) {
  const [dx, dz] = [animal.tx - animal.x, animal.tz - animal.z];
  const heading = Math.hypot(dx, dz) > 0.05;
  const walking = animal.rest <= 0 && heading;
  return [
    animal.x,
    standingAt(cells, animal.x, animal.z),
    animal.z,
    // At rest with nowhere to go, each animal keeps a heading of its own instead of all facing one way.
    heading
      ? Math.atan2(dx, dz)
      : (animal.x * 7.3 + animal.z * 3.1) % (2 * Math.PI),
    walking ? 0.06 : 0,
  ];
}

/**
 * Every body to draw at `time` seconds, by kind (ADR 0047, D21): each animal
 * of the herd and the learner's fox on its own ground, facing where it goes,
 * and the whale on its round. Each kind comes with its bodies as one run of
 * numbers, `BODY_STRIDE` a body, for the painter to draw them all at once.
 */
export function bodiesOf(cells: Cells, herd: readonly Animal[], time: number) {
  const whale = whaleAt(time);
  return Arr.map(BodyKind.literals, (kind) => {
    const own =
      kind === "whale"
        ? [[whale.x, whale.y, whale.z, whale.yaw, 0]]
        : Arr.map(
            Arr.filter(herd, (animal) => animal.kind === kind),
            (animal) => animalBody(cells, animal)
          );
    return [kind, Float32Array.from(Arr.flatten(own))] as const;
  });
}
