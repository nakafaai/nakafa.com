import { Option, Schema } from "effect";

/**
 * The ways that a call to a sitting ends without a seat, as the server names them. An entry, the paper,
 * and an attempt's screen all show the sentence of one of these, so each reason has one sentence.
 */
export const EntryFailure = Schema.Literals([
  "AttemptClosed",
  "AttemptLocked",
  "DeviceRetired",
  "NotInSitting",
  "SecondDevice",
  "SittingClosed",
  "SittingLocked",
  "SittingNotOpen",
]);

/** The reasons that the server gives for a refused entry, where the attempt is not an error. */
const EntryRefusal = Schema.Literals(["TokenRefused", "TooManyTries"]);

/** The copy key of one sentence that the student's screen shows when the entry does not admit them. */
export const EntryMessage = Schema.Literals([
  "student-attempt-closed",
  "student-closed",
  "student-device-retired",
  "student-locked",
  "student-locked-school",
  "student-not-in-sitting",
  "student-not-open",
  "student-second-device",
  "student-token-refused",
  "student-too-many-tries",
]);

/** The sentence that the screen shows for each failure of a call. */
const failureMessages: Record<
  typeof EntryFailure.Type,
  typeof EntryMessage.Type
> = {
  AttemptClosed: "student-attempt-closed",
  AttemptLocked: "student-locked",
  DeviceRetired: "student-device-retired",
  NotInSitting: "student-not-in-sitting",
  SecondDevice: "student-second-device",
  SittingClosed: "student-closed",
  SittingLocked: "student-locked-school",
  SittingNotOpen: "student-not-open",
};

/** The sentence that the screen shows for each refused reason of an entry. */
const refusalMessages: Record<
  typeof EntryRefusal.Type,
  typeof EntryMessage.Type
> = {
  TokenRefused: "student-token-refused",
  TooManyTries: "student-too-many-tries",
};

/** The sentence for a failed call, or none when the error is not one that a sitting call names. */
export function sittingFailureMessage(
  error: unknown
): Option.Option<typeof EntryMessage.Type> {
  return Option.map(
    Schema.decodeUnknownOption(Schema.Struct({ _tag: EntryFailure }))(error),
    (failure) => failureMessages[failure._tag]
  );
}

/** The sentence for a refused entry, which names the token or the tries. */
export function entryRefusalMessage(
  reason: typeof EntryRefusal.Type
): typeof EntryMessage.Type {
  return refusalMessages[reason];
}
