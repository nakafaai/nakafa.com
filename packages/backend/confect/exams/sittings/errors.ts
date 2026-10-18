import { refusal } from "@repo/backend/confect/tenancy/errors";
import { Schema } from "effect";

/** A student who may not enter this sitting. The reply names no part of the sitting. */
export class NotInSitting extends Schema.TaggedError<NotInSitting>()(
  "NotInSitting",
  { ...refusal("NOT_IN_SITTING", "You are not in this sitting.") }
) {}

/** A sitting whose opening time has not come yet. */
export class SittingNotOpen extends Schema.TaggedError<SittingNotOpen>()(
  "SittingNotOpen",
  { ...refusal("SITTING_NOT_OPEN", "This sitting has not opened yet.") }
) {}

/** A sitting that has closed, so a new student may not enter it. */
export class SittingClosed extends Schema.TaggedError<SittingClosed>()(
  "SittingClosed",
  { ...refusal("SITTING_CLOSED", "This sitting has closed.") }
) {}

/** A sitting whose school is suspended, or whose unit is archived, so it admits and records nothing. */
export class SittingLocked extends Schema.TaggedError<SittingLocked>()(
  "SittingLocked",
  { ...refusal("SITTING_LOCKED", "This sitting is locked.") }
) {}

/** An attempt that has passed its deadline, or that is closing or submitted. */
export class AttemptClosed extends Schema.TaggedError<AttemptClosed>()(
  "AttemptClosed",
  { ...refusal("ATTEMPT_CLOSED", "This attempt has closed.") }
) {}

/** A device that does not own the attempt. A proctor can allow a second device. */
export class SecondDevice extends Schema.TaggedError<SecondDevice>()(
  "SecondDevice",
  {
    ...refusal(
      "SECOND_DEVICE",
      "This attempt belongs to another device. A proctor can allow a second device."
    ),
  }
) {}

/** A device that a proctor retired from the attempt, which may no longer write. */
export class DeviceRetired extends Schema.TaggedError<DeviceRetired>()(
  "DeviceRetired",
  {
    ...refusal(
      "DEVICE_RETIRED",
      "A proctor retired this device from the attempt."
    ),
  }
) {}

/** An attempt that has retired as many devices as it may, so a proctor cannot allow another. */
export class RetiredDevicesFull extends Schema.TaggedError<RetiredDevicesFull>()(
  "RetiredDevicesFull",
  {
    ...refusal(
      "RETIRED_DEVICES_FULL",
      "This attempt has retired as many devices as it can."
    ),
  }
) {}

/**
 * A schedule the server refuses, and the rule it breaks: `closesAt` when the closing time is
 * not after the opening time, `opensAt` when the opening is more than a minute in the past,
 * and `cohort` when the cohort is not active.
 */
export class ScheduleInvalid extends Schema.TaggedError<ScheduleInvalid>()(
  "ScheduleInvalid",
  {
    ...refusal(
      "SCHEDULE_INVALID",
      "This sitting cannot be scheduled as given."
    ),
    reason: Schema.Literals(["closesAt", "cohort", "opensAt"]),
  }
) {}

/**
 * An exam with questions that have no answer key that fits them. `questions` holds the
 * order number of each such question, counted from one.
 */
export class KeysMissing extends Schema.TaggedError<KeysMissing>()(
  "KeysMissing",
  {
    ...refusal(
      "KEYS_MISSING",
      "Mark the correct answer of every question before you schedule the exam."
    ),
    questions: Schema.Array(Schema.Int.check(Schema.isGreaterThan(0))),
  }
) {}
