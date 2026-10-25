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
  "StaleAnswer",
]);
type SittingReason = typeof SittingReason.Type;

/**
 * The locks that lift later: a proctor's unlock of the attempt, or the school's or the unit's unlock. A
 * refused answer for a lock keeps the answer the browser holds, because the next visit to the paper sends it.
 */
const LockReason = Schema.Literals(["AttemptLocked", "SittingLocked"]);

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
 * The sentence that an entry or a paper shows for each reason. Every reason has a line, so a new reason cannot
 * be left out of the sentences: a reason with no sentence is `undefined`.
 */
const sentences: Record<SittingReason, typeof EntryMessage.Type | undefined> = {
  AttemptClosed: "student-attempt-closed",
  AttemptLocked: "student-locked",
  DeviceRetired: "student-device-retired",
  NotInSitting: "student-not-in-sitting",
  QuestionNotInExam: undefined,
  ResponseDoesNotFit: undefined,
  SecondDevice: "student-second-device",
  SittingClosed: "student-closed",
  SittingLocked: "student-locked-school",
  SittingNotOpen: "student-not-open",
  StaleAnswer: undefined,
};

/**
 * The toast that an answer or a finish shows for each reason it refuses. Every reason has a line, and a reason
 * that refuses no answer or finish is `undefined`.
 */
const toasts: Record<SittingReason, ToastCopy | undefined> = {
  AttemptClosed: {
    description: "sitting-attempt-closed.description",
    title: "sitting-attempt-closed.title",
  },
  AttemptLocked: {
    description: "sitting-attempt-locked.description",
    title: "sitting-attempt-locked.title",
  },
  DeviceRetired: {
    description: "sitting-device-retired.description",
    title: "sitting-device-retired.title",
  },
  NotInSitting: {
    description: "sitting-not-in.description",
    title: "sitting-not-in.title",
  },
  QuestionNotInExam: {
    description: "sitting-question-missing.description",
    title: "sitting-question-missing.title",
  },
  ResponseDoesNotFit: {
    description: "sitting-response-refused.description",
    title: "sitting-response-refused.title",
  },
  SecondDevice: {
    description: "sitting-second-device.description",
    title: "sitting-second-device.title",
  },
  SittingClosed: undefined,
  SittingLocked: {
    description: "sitting-locked.description",
    title: "sitting-locked.title",
  },
  SittingNotOpen: undefined,
  StaleAnswer: {
    description: "sitting-stale-answer.description",
    title: "sitting-stale-answer.title",
  },
};

/** The reason that a failed call names, or none when the error names no sitting reason. */
function reasonOf(error: unknown) {
  return Option.map(
    Schema.decodeUnknownOption(Schema.Struct({ _tag: SittingReason }))(error),
    (failure) => failure._tag
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
    (reason) => toasts[reason] !== undefined && !Schema.is(LockReason)(reason)
  );
}

/** The sentence for a failed call, or none when the error names no sentence. */
export function sittingFailureMessage(
  error: unknown
): Option.Option<typeof EntryMessage.Type> {
  return Option.flatMap(reasonOf(error), (reason) =>
    Option.fromNullishOr(sentences[reason])
  );
}

/**
 * The toast for a refused answer or finish, or none when the error is not one of those refusals. A
 * none is a failure that the caller reports, because the server did not name a reason to the student.
 */
export function refusalCopyOf(error: unknown): Option.Option<ToastCopy> {
  return Option.flatMap(reasonOf(error), (reason) =>
    Option.fromNullishOr(toasts[reason])
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
