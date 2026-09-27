import { Schema } from "effect";
export const tryoutAttemptAccessSourceKindFree = "free";
export const tryoutAttemptAccessSourceKindCompetition = "competition";
export const tryoutAttemptAccessSourceKindAccessPass = "access-pass";
export const tryoutAttemptAccessSourceKindSubscription = "subscription";
export const tryoutAttemptAccessSourceKindValidator = Schema.Literals([
  tryoutAttemptAccessSourceKindFree,
  tryoutAttemptAccessSourceKindCompetition,
  tryoutAttemptAccessSourceKindAccessPass,
  tryoutAttemptAccessSourceKindSubscription,
]);
export type TryoutAttemptAccessSourceKind = Schema.Schema.Type<
  typeof tryoutAttemptAccessSourceKindValidator
>;
