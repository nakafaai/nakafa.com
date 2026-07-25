import type { Infer } from "convex/values";
import { literals } from "convex-helpers/validators";

export const tryoutAttemptAccessSourceKindFree = "free";
export const tryoutAttemptAccessSourceKindCompetition = "competition";
export const tryoutAttemptAccessSourceKindAccessPass = "access-pass";
export const tryoutAttemptAccessSourceKindSubscription = "subscription";

export const tryoutAttemptAccessSourceKindValidator = literals(
  tryoutAttemptAccessSourceKindFree,
  tryoutAttemptAccessSourceKindCompetition,
  tryoutAttemptAccessSourceKindAccessPass,
  tryoutAttemptAccessSourceKindSubscription
);
export type TryoutAttemptAccessSourceKind = Infer<
  typeof tryoutAttemptAccessSourceKindValidator
>;
