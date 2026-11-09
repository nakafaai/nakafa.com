import { idOf } from "@repo/backend/confect/island/blocks";
import { HEIGHT } from "@repo/backend/confect/island/world";
import { Array as Arr } from "effect";
import type { Edit } from "@/lib/island/edits";
import { KIND, LOOK } from "@/lib/island/look";
import { blockAt, type Cells, cellOf } from "@/lib/island/world";

/** The blocks loose enough to fall when nothing holds them up: sand, which every island may build with. */
const LOOSE = [idOf("sand")];

/** Whether a cell holds nothing a block could rest on: air, water or a plant. */
function isHollow(cells: Cells, x: number, y: number, z: number) {
  const kind = LOOK.kinds[blockAt(cells, x, y, z)];
  return kind === KIND.air || kind === KIND.liquid || kind === KIND.cross;
}

/** One cell set to a block, as an edit from what it held. */
function setTo(
  cells: Cells,
  x: number,
  y: number,
  z: number,
  block: number
): Edit {
  const edit = { after: block, before: blockAt(cells, x, y, z), x, y, z };
  cells[cellOf(x, y, z)] = block;
  return edit;
}

/**
 * What one column does after a change (ADR 0047, D14): a plant with no ground
 * under it is lost, and every loose block over a hollow drops down the column
 * until it rests on something solid, from the bottom up, so a stack of sand
 * falls together. Answers the edits it made, writing them into `cells`.
 */
function settleColumn(cells: Cells, x: number, z: number) {
  let edits: readonly Edit[] = [];
  for (let y = 1; y < HEIGHT; y += 1) {
    const block = blockAt(cells, x, y, z);
    if (LOOK.kinds[block] === KIND.cross && isHollow(cells, x, y - 1, z)) {
      edits = Arr.append(edits, setTo(cells, x, y, z, 0));
      continue;
    }
    if (!(Arr.contains(LOOSE, block) && isHollow(cells, x, y - 1, z))) {
      continue;
    }
    let rest = y - 1;
    while (rest > 0 && isHollow(cells, x, rest - 1, z)) {
      rest -= 1;
    }
    edits = Arr.appendAll(edits, [
      setTo(cells, x, y, z, 0),
      setTo(cells, x, rest, z, block),
    ]);
  }
  return edits;
}

/**
 * The world settling after edits were written into `cells` (ADR 0047, D14):
 * in every column an edit touched, plants without ground are lost and sand
 * falls until it rests. Other blocks hold where they are, as built
 * walls and roofs do. The edits it answers are already written into `cells`,
 * and belong with the change that caused them, so one undo takes back both.
 */
export function settleOf(cells: Cells, edits: readonly Edit[]) {
  const columns = Arr.dedupeWith(
    Arr.map(edits, (edit) => [edit.x, edit.z] as const),
    (a, b) => a[0] === b[0] && a[1] === b[1]
  );
  return Arr.flatMap(columns, ([x, z]) => settleColumn(cells, x, z));
}
