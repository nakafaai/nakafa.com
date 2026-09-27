import { Schema } from "effect";
export const tryoutAttemptAccessSourceKindFree = "free";
export const tryoutAttemptAccessSourceKindSubscription = "subscription";
export const tryoutAttemptAccessSourceKindValidator = Schema.Literals([
  tryoutAttemptAccessSourceKindFree,
  tryoutAttemptAccessSourceKindSubscription,
]);
export type TryoutAttemptAccessSourceKind = Schema.Schema.Type<
  typeof tryoutAttemptAccessSourceKindValidator
>;
