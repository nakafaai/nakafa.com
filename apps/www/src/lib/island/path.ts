import { HEIGHT, SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option } from "effect";
import { KIND, LOOK } from "@/lib/island/look";
import { isPassable } from "@/lib/island/plants";
import { SCALE } from "@/lib/island/scale";
import { blockAt, type Cells } from "@/lib/island/world";

/** Whether a cell lets a body through: air, or a plant low enough to walk among. */
function isOpenCell(cells: Cells, x: number, y: number, z: number) {
  return isPassable(blockAt(cells, x, y, z));
}

/** Whether a cell holds a body up: a solid block or glass, never water or a plant. */
function isFloor(cells: Cells, x: number, y: number, z: number) {
  const kind = LOOK.kinds[blockAt(cells, x, y, z)];
  return kind === KIND.solid || kind === KIND.cutout;
}

/**
 * The row a person's feet stand in on column (x, z) (ADR 0047, D12): the cell
 * over the column's highest floor, with room above it for a body two blocks
 * tall. None when the column has no floor, or no room over it.
 */
export function standOf(cells: Cells, x: number, z: number) {
  if (x < 0 || z < 0 || x >= SPAN || z >= SPAN) {
    return Option.none();
  }
  return Option.flatMap(
    Arr.findFirst(
      Arr.makeBy(HEIGHT - 1, (index) => HEIGHT - 2 - index),
      (y) => isFloor(cells, x, y, z)
    ),
    (floor) => {
      const feet = floor + 1;
      const room = Arr.every(
        Arr.makeBy(SCALE.person, (index) => feet + index),
        (y) => y < HEIGHT && isOpenCell(cells, x, y, z)
      );
      return room ? Option.some(feet) : Option.none();
    }
  );
}

/** The four steps a walker may take from a column. */
const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** The most columns one search visits, so a press far away answers at once. */
const SEARCH = SPAN * SPAN;

/**
 * The columns a walker crosses from `from` to `to`, `from` left out (ADR 0047,
 * D12): the shortest way over columns it can stand on, climbing or dropping
 * at most one block a step, like a person on a hill of blocks. None when no
 * way leads there.
 */
export function pathOf(
  cells: Cells,
  from: readonly [number, number],
  to: readonly [number, number]
) {
  const start = from[1] * SPAN + from[0];
  const goal = to[1] * SPAN + to[0];
  const ground = standOf(cells, from[0], from[1]);
  if (Option.isNone(ground) || Option.isNone(standOf(cells, to[0], to[1]))) {
    return Option.none();
  }
  const before = new Int32Array(SPAN * SPAN).fill(-1);
  // The height each reached cell is stood on, so a step compares feet without asking again.
  const feet = new Int16Array(SPAN * SPAN);
  feet[start] = ground.value;
  const queue = new Int32Array(SEARCH);
  before[start] = start;
  queue[0] = start;
  let head = 0;
  let tail = 1;
  while (head < tail && before[goal] === -1) {
    const at = queue[head];
    head += 1;
    const x = at % SPAN;
    const z = Math.floor(at / SPAN);
    for (const [dx, dz] of STEPS) {
      const next = (z + dz) * SPAN + x + dx;
      const stand = standOf(cells, x + dx, z + dz);
      if (
        tail < SEARCH &&
        x + dx >= 0 &&
        x + dx < SPAN &&
        before[next] === -1 &&
        Option.isSome(stand) &&
        Math.abs(stand.value - feet[at]) <= 1
      ) {
        feet[next] = stand.value;
        before[next] = at;
        queue[tail] = next;
        tail += 1;
      }
    }
  }
  if (before[goal] === -1) {
    return Option.none();
  }
  let route: readonly (readonly [number, number])[] = [];
  for (let at = goal; at !== start; at = before[at]) {
    route = Arr.prepend(route, [at % SPAN, Math.floor(at / SPAN)] as const);
  }
  return Option.some(route);
}
