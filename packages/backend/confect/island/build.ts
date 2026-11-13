import { isOpen, keyOf } from "@repo/backend/confect/island/blocks";
import {
  type Edit,
  footprintOf,
  MAX_EDITS,
  mergeEdits,
} from "@repo/backend/confect/island/world";
import { Array as Arr, Option, Result, Schema } from "effect";

/**
 * Why the island refused a batch of edits (ADR 0047, D6), and at which edit:
 * a cell outside the footprint the island's level covers, the bedrock row
 * that holds the world up, an id no block holds, a block the level has not
 * opened yet, or more changed cells than one island may keep.
 */
export class BuildRefused extends Schema.TaggedError<
  BuildRefused,
  { readonly brand: unique symbol }
>()("BuildRefused", {
  index: Schema.Int,
  reason: Schema.Literals(["outside", "bedrock", "unknown", "locked", "full"]),
}) {}

/** Why one edit cannot be built at this level and footprint, none when it can. */
function refusalOf(edit: Edit, level: number, size: number) {
  const footprint = footprintOf(size);
  const inside = (cell: number) =>
    cell >= footprint.from && cell <= footprint.to;
  if (!(inside(edit.x) && inside(edit.z))) {
    return Option.some("outside" as const);
  }
  if (edit.y === 0) {
    return Option.some("bedrock" as const);
  }
  if (edit.block === 0) {
    return Option.none();
  }
  return Option.match(keyOf(edit.block), {
    onNone: () => Option.some("unknown" as const),
    onSome: (key) =>
      isOpen(key, level) ? Option.none() : Option.some("locked" as const),
  });
}

/**
 * The stored edits with a batch built over them, or the first edit the rules
 * refuse (ADR 0047, D6 and D7). The whole batch is refused when any edit is,
 * so the island never keeps half of what the learner did.
 */
export function buildEdits(
  stored: readonly Edit[],
  batch: readonly Edit[],
  level: number,
  size: number
) {
  const refusal = Option.flatMap(
    Arr.findFirstIndex(batch, (edit) =>
      Option.isSome(refusalOf(edit, level, size))
    ),
    (index) =>
      Option.map(
        refusalOf(batch[index], level, size),
        (reason) => new BuildRefused({ index, reason })
      )
  );
  if (Option.isSome(refusal)) {
    return Result.fail(refusal.value);
  }
  const merged = mergeEdits(stored, batch);
  return merged.length > MAX_EDITS
    ? Result.fail(new BuildRefused({ index: batch.length - 1, reason: "full" }))
    : Result.succeed(merged);
}
