"use client";

import type { SittingView } from "@repo/backend/confect/exams/sittings/contract";
import { Array as Arr, Order } from "effect";

/** The part of a sitting that its order reads: whether it is open, and when it opens. */
type Listed = Pick<typeof SittingView.Type, "opensAt" | "state">;

/** An open sitting ranks before a scheduled one, because a student may enter it now. */
const byLive = Order.mapInput(Order.Number, (sitting: Listed) =>
  sitting.state === "open" ? 0 : 1
);

/** The opening times of two sittings, earliest first. */
const byOpening = Order.mapInput(
  Order.Number,
  (sitting: Listed) => sitting.opensAt
);

/**
 * The student's sittings in the order the home lists them: the open sittings first, then the
 * scheduled ones, each group by its opening time.
 */
export function orderSittings<A extends Listed>(
  sittings: readonly A[]
): readonly A[] {
  return Arr.sort(sittings, Order.combine(byLive, byOpening));
}
