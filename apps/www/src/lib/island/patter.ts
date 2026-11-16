import { idOf } from "@repo/backend/confect/island/blocks";
import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr } from "effect";
import { skylineOf } from "@/lib/island/ground";
import { blockAt, type Cells } from "@/lib/island/world";

/** The blocks rain patters on: the roofs of the village. */
const ROOFS = [idOf("roof"), idOf("slate")];

/**
 * How much of the island rain patters on (ADR 0047, D42): the share of its
 * land columns whose top is a roof, from 0 to 1. The rest of the land is
 * grass, sand and crowns, where rain hisses instead.
 */
export function roofShareOf(cells: Cells) {
  const skyline = skylineOf(cells);
  const tops = Arr.filter(
    Arr.makeBy(SPAN * SPAN, (column) => column),
    (column) => skyline[column] >= 0
  );
  const roofs = Arr.filter(tops, (column) =>
    Arr.contains(
      ROOFS,
      blockAt(cells, column % SPAN, skyline[column], Math.floor(column / SPAN))
    )
  );
  return tops.length === 0 ? 0 : roofs.length / tops.length;
}
