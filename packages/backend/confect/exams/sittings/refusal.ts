import type { AttemptRefused } from "@repo/backend/confect/assessment/gate/refusal";
import {
  AttemptClosed,
  AttemptLocked,
  DeviceRetired,
  NotInSitting,
  QuestionNotInExam,
  SecondDevice,
  SittingClosed,
  SittingLocked,
  SittingNotOpen,
} from "@repo/backend/confect/exams/sittings/errors";

/**
 * The sitting's own error for each reason the gate refuses a write or an entry with. Every
 * reason has one error, so a function maps the gate's refusal the same way everywhere.
 */
const errors = {
  AttemptClosed: () => new AttemptClosed(),
  Closed: () => new SittingClosed(),
  DeviceRetired: () => new DeviceRetired(),
  Expired: () => new AttemptClosed(),
  Locked: () => new AttemptLocked(),
  Missing: () => new NotInSitting(),
  NotOpen: () => new SittingNotOpen(),
  OtherDevice: () => new SecondDevice(),
  PlaceLocked: () => new SittingLocked(),
  SectionClosed: () => new AttemptClosed(),
} satisfies Record<AttemptRefused["reason"]["_tag"], () => unknown>;

/** The sitting's error for one refusal of the gate. */
export const toSittingError = (refused: AttemptRefused) =>
  errors[refused.reason._tag]();

/**
 * The refusals of every sitting write and read that passes the gate (ADR 0013). A
 * function's error channel lists these, because the gate's one guard sequence can raise
 * any of them for any of its writes.
 */
export const SITTING_REFUSALS = [
  NotInSitting,
  SittingLocked,
  AttemptClosed,
  AttemptLocked,
  SecondDevice,
  DeviceRetired,
  SittingNotOpen,
  SittingClosed,
  QuestionNotInExam,
] as const;
