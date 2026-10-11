import { FUSION_RANK_CONSTANT } from "@repo/backend/confect/contents/sections/limits";
import { Array as Arr, Option, Order } from "effect";

/**
 * Merges ranked lists into one by reciprocal rank fusion. An item scores
 * `1 / (k + rank)` in each list that holds it, ranks counted from one, and its
 * scores add up, so an item that two lists both rank well beats an item that
 * only one list ranks first. `identify` tells which items are the same; the
 * first item seen for an identity is the one returned, and an identity counts
 * once per list, at its best rank. Items with equal scores keep the order in
 * which they first appeared.
 */
export function fuseRanks<Item>(
  lists: readonly (readonly Item[])[],
  identify: (item: Item) => string
) {
  /** What an identity earns from one list: nothing when the list lacks it. */
  const earned = (list: readonly Item[], identity: string) =>
    Option.match(
      Arr.findFirstIndex(list, (item) => identify(item) === identity),
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
        lists,
        0,
        (total, list) => total + earned(list, identify(item))
      ),
    Order.flip(Order.Number)
  );
}
