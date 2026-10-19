import type { ToastCopy } from "@repo/design-system/lib/toast/notify";
import { Array as Arr, Option, Schema } from "effect";

/**
 * The reasons that a sitting call ends with, as the server names them. An entry, the paper, and an attempt's
 * screen show the sentence of a reason that has one, and an answer or a finish shows the toast of a reason
 * that refuses one. A reason with neither is one that the screen does not name, so the generic failure stands in.
 */
const SittingReason = Schema.Literals([
  "AttemptClosed",
  "AttemptLocked",
  "DeviceRetired",
  "NotInSitting",
  "QuestionNotInExam",
  "ResponseDoesNotFit",
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

/**
 * The copy of each reason, so one table owns the sentence and the toast of every reason: the sentence that an
 * entry or a paper shows, and the toast that an answer or a finish shows when it is refused for the reason.
 */
const reasons: Record<
  typeof SittingReason.Type,
  {
    readonly message?: typeof EntryMessage.Type;
    readonly toast?: ToastCopy;
    /** A lock that lifts later: a proctor's unlock of the attempt, or the school's or the unit's unlock. */
    readonly lifts?: true;
  }
> = {
  AttemptClosed: {
    message: "student-attempt-closed",
    toast: {
      description: "sitting-attempt-closed.description",
      title: "sitting-attempt-closed.title",
    },
  },
  AttemptLocked: {
    lifts: true,
    message: "student-locked",
    toast: {
      description: "sitting-attempt-locked.description",
      title: "sitting-attempt-locked.title",
    },
  },
  DeviceRetired: {
    message: "student-device-retired",
    toast: {
      description: "sitting-device-retired.description",
      title: "sitting-device-retired.title",
    },
  },
  NotInSitting: {
    message: "student-not-in-sitting",
    toast: {
      description: "sitting-not-in.description",
      title: "sitting-not-in.title",
    },
  },
  QuestionNotInExam: {
    toast: {
      description: "sitting-question-missing.description",
      title: "sitting-question-missing.title",
    },
  },
  ResponseDoesNotFit: {
    toast: {
      description: "sitting-response-refused.description",
      title: "sitting-response-refused.title",
    },
  },
  SecondDevice: {
    message: "student-second-device",
    toast: {
      description: "sitting-second-device.description",
      title: "sitting-second-device.title",
    },
  },
  SittingClosed: { message: "student-closed" },
  SittingLocked: {
    lifts: true,
    message: "student-locked-school",
    toast: {
      description: "sitting-locked.description",
      title: "sitting-locked.title",
    },
  },
  SittingNotOpen: { message: "student-not-open" },
};

/** The copy of the reason that a failed call names, or none when the error names no sitting reason. */
function reasonOf(error: unknown) {
  return Option.map(
    Schema.decodeUnknownOption(Schema.Struct({ _tag: SittingReason }))(error),
    (failure) => reasons[failure._tag]
  );
}

/**
 * Whether a refused answer or finish is final, so the browser drops the answer that it keeps for it. The server
 * will not take such an answer later. A refusal for a lock is not final, because the lock lifts, and the next
 * visit to the paper sends the kept answer again. Any error that is not a refusal is not final either.
 */
export function isFinalRefusal(error: unknown): boolean {
  return Option.exists(
    reasonOf(error),
    (copy) => copy.toast !== undefined && copy.lifts !== true
  );
}

/** The sentence for a failed call, or none when the error names no sentence. */
export function sittingFailureMessage(
  error: unknown
): Option.Option<typeof EntryMessage.Type> {
  return Option.flatMap(reasonOf(error), (copy) =>
    Option.fromNullishOr(copy.message)
  );
}

/**
 * The toast for a refused answer or finish, or none when the error is not one of those refusals. A
 * none is a failure that the caller reports, because the server did not name a reason to the student.
 */
export function refusalCopyOf(error: unknown): Option.Option<ToastCopy> {
  return Option.flatMap(reasonOf(error), (copy) =>
    Option.fromNullishOr(copy.toast)
  );
}

/** The generic toast of a sitting call that failed without naming a refusal. */
const GENERIC_FAILURE: ToastCopy = {
  description: "action-error.description",
  title: "action-error.title",
};

/**
 * The one toast of a group of failed calls, such as the answers of a resent paper: the refusal copy of the
 * group's first failure when it names a refusal, and the generic copy otherwise. A group with no failure has none.
 */
export function failureGroupCopyOf(
  errors: readonly unknown[]
): Option.Option<ToastCopy> {
  return Option.map(Arr.head(errors), (first) =>
    Option.getOrElse(refusalCopyOf(first), () => GENERIC_FAILURE)
  );
}

/** The sentence that the screen shows for each refused reason of an entry. */
const refusalMessages: Record<
  typeof EntryRefusal.Type,
  typeof EntryMessage.Type
> = {
  TokenRefused: "student-token-refused",
  TooManyTries: "student-too-many-tries",
};

/** The sentence for a refused entry, which names the token or the tries. */
export function entryRefusalMessage(
  reason: typeof EntryRefusal.Type
): typeof EntryMessage.Type {
  return refusalMessages[reason];
}
