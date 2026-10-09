import { Schema } from "effect";
export const tryoutStatusValidator = Schema.Literals([
  "in-progress",
  "completed",
  "expired",
]);
export type TryoutStatus = typeof tryoutStatusValidator.Type;
export const tryoutStatusRankValidator = Schema.Literals([1, 2, 3]);
type TryoutStatusRank = typeof tryoutStatusRankValidator.Type;

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
