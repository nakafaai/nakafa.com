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
