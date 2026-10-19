import type { ToastCopy } from "@repo/design-system/lib/toast/notify";
import { Option, Schema } from "effect";

/**
 * The refusals that an answer or a finish can meet, each with its reason and its next step. The toast
 * shows the reason as its title and the next step as its description, both from the Toast namespace.
 */
const RefusalReason = Schema.Literals([
  "AttemptClosed",
  "AttemptLocked",
  "DeviceRetired",
  "NotInSitting",
  "QuestionNotInExam",
  "ResponseDoesNotFit",
  "SecondDevice",
  "SittingLocked",
]);

/** The toast that tells each refusal, keyed by the reason the server names. */
const refusalCopies: Record<typeof RefusalReason.Type, ToastCopy> = {
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
  SittingLocked: {
    description: "sitting-locked.description",
    title: "sitting-locked.title",
  },
};

/**
 * The toast for a refused answer or finish, or none when the error is not one of those refusals. A
 * none is a failure that the caller reports, because the server did not name a reason to the student.
 */
export function refusalCopyOf(error: unknown): Option.Option<ToastCopy> {
  return Option.map(
    Schema.decodeUnknownOption(Schema.Struct({ _tag: RefusalReason }))(error),
    (refusal) => refusalCopies[refusal._tag]
  );
}
