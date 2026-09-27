import { Schema } from "effect";
export const tryoutStatusValidator = Schema.Literals([
  "in-progress",
  "completed",
  "expired",
]);
export type TryoutStatus = Schema.Schema.Type<typeof tryoutStatusValidator>;
export const tryoutStatusRankValidator = Schema.Literals([1, 2, 3]);
export type TryoutStatusRank = Schema.Schema.Type<
  typeof tryoutStatusRankValidator
>;

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
