import { describe, expect, it } from "@effect/vitest";
import {
  AttemptRefused,
  Closed,
  DeviceRetired,
  Expired,
  AttemptClosed as GateAttemptClosed,
  Locked,
  Missing,
  NotOpen,
  OtherDevice,
  PlaceLocked,
  SectionClosed,
} from "@repo/backend/confect/assessment/gate/refusal";
import {
  AttemptClosed,
  AttemptLocked,
  NotInSitting,
  SecondDevice,
  SittingClosed,
  DeviceRetired as SittingDeviceRetired,
  SittingLocked,
  SittingNotOpen,
} from "@repo/backend/confect/exams/sittings/errors";
import { toSittingError } from "@repo/backend/confect/exams/sittings/refusal";

describe("exams/sittings refusal", () => {
  it.each([
    [new Missing(), NotInSitting],
    [new GateAttemptClosed(), AttemptClosed],
    [new Locked(), AttemptLocked],
    [new OtherDevice(), SecondDevice],
    [new DeviceRetired(), SittingDeviceRetired],
    [new SectionClosed(), AttemptClosed],
    [new Expired({ deadline: 1 }), AttemptClosed],
    [new PlaceLocked(), SittingLocked],
    [new NotOpen(), SittingNotOpen],
    [new Closed(), SittingClosed],
  ])("maps the %s refusal to the sitting's own error", (reason, error) => {
    expect(toSittingError(new AttemptRefused({ reason }))).toBeInstanceOf(
      error
    );
  });
});
