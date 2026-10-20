import type { StudentSittingRow } from "@repo/backend/confect/exams/sittings/contract";
import { Array as Arr, type Option, Order } from "effect";

/** The part of a sitting that its order reads: its state, when it opens, and the student's attempt in it. */
type Listed = Pick<
  typeof StudentSittingRow.Type,
  "attempt" | "opensAt" | "state"
>;

/**
 * The group of a sitting in the student's list: an open sitting that the student may still enter comes
 * first, then a scheduled one, then a sitting that is finished for the student or closed, whose results
 * wait for the teacher. The group keeps the sittings the student has to act on at the top.
 */
const byGroup = Order.mapInput(Order.Number, (sitting: Listed) => {
  if (sitting.attempt === "submitted" || sitting.state === "closed") {
    return 2;
  }
  return sitting.state === "open" ? 0 : 1;
});

/** The opening times of two sittings, earliest first. */
const byOpening = Order.mapInput(
  Order.Number,
  (sitting: Listed) => sitting.opensAt
);

/**
 * The student's sittings in the order the home lists them: the open sittings first, then the scheduled
 * ones, then the finished and closed ones, each group by its opening time.
 */
export function orderSittings<A extends Listed>(
  sittings: readonly A[]
): readonly A[] {
  return Arr.sort(sittings, Order.combine(byGroup, byOpening));
}

/**
 * The first sitting that the student may enter now: an open sitting whose attempt is not submitted. The school
 * home's header and its student tile both name this sitting, so they never disagree about which one to enter.
 */
export function enterableSitting<A extends Listed>(
  sittings: readonly A[]
): Option.Option<A> {
  return Arr.findFirst(
    sittings,
    (sitting) => sitting.state === "open" && sitting.attempt !== "submitted"
  );
}
