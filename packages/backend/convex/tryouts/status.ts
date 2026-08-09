import type { Infer } from "convex/values";
import { literals } from "convex-helpers/validators";

export const tryoutStatusValidator = literals(
  "in-progress",
  "completed",
  "expired"
);
export type TryoutStatus = Infer<typeof tryoutStatusValidator>;

export const tryoutStatusRankValidator = literals(1, 2, 3);
export type TryoutStatusRank = Infer<typeof tryoutStatusRankValidator>;

/** Returns the stable workflow rank used by progress indexes. */
export function getTryoutStatusRank(status: TryoutStatus): TryoutStatusRank {
  if (status === "in-progress") {
    return 1;
  }

  if (status === "completed") {
    return 2;
  }

  return 3;
}
