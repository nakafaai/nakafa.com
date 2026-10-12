import { FUSION_RANK_CONSTANT } from "@repo/backend/confect/contents/sections/limits";
import type { SectionDraft } from "@repo/backend/confect/contents/sections/schema";
import { Array as Arr, Option, Order } from "effect";

/**
 * The place of a section in its document as one string: the same for the
 * section in every language that has it, so that fusion counts the languages
 * of one place as one candidate.
 */
export function placeOf({
  contentKey,
  ordinal,
}: Pick<SectionDraft, "contentKey" | "ordinal">) {
  return `${contentKey}#${ordinal}`;
}

/**
 * Merges ranked lists into one by reciprocal rank fusion. An item scores
 * `1 / (k + rank)` in each list that holds it, ranks counted from one, and its
 * scores add up, so an item that two lists both rank well beats an item that
 * only one list ranks first. `identify` tells which items are the same. A list
 * ranks identities, not items: an identity that a list holds more than once,
 * such as the same place in three languages, takes the rank of its first item
 * and leaves the later identities their own ranks. The first item seen for an
 * identity is the one returned, and items with equal scores keep the order in
 * which they first appeared.
 */
export function fuseRanks<Item>(
  lists: readonly (readonly Item[])[],
  identify: (item: Item) => string
) {
  const rankings = Arr.map(lists, (list) =>
    Arr.dedupe(Arr.map(list, identify))
  );
  /** What an identity earns from one ranking: nothing when the ranking lacks it. */
  const earned = (ranking: readonly string[], identity: string) =>
    Option.match(
      Arr.findFirstIndex(ranking, (ranked) => ranked === identity),
      {
        onNone: () => 0,
        onSome: (index) => 1 / (FUSION_RANK_CONSTANT + index + 1),
      }
    );
  const candidates: Item[] = Arr.flatMap(lists, (list) => list);
  return Arr.sortWith(
    Arr.dedupeWith(
      candidates,
      (left, right) => identify(left) === identify(right)
    ),
    (item: Item) =>
      Arr.reduce(
        rankings,
        0,
        (total, ranking) => total + earned(ranking, identify(item))
      ),
    Order.flip(Order.Number)
  );
}
