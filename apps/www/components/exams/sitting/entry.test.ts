import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  entryFailureMessage,
  entryRefusalMessage,
} from "@/components/exams/sitting/entry";

describe("entryFailureMessage", () => {
  it("names the sentence of each way an entry ends without a seat", () => {
    expect(entryFailureMessage({ _tag: "NotInSitting" })).toEqual(
      Option.some("student-not-in-sitting")
    );
    expect(entryFailureMessage({ _tag: "SittingNotOpen" })).toEqual(
      Option.some("student-not-open")
    );
    expect(entryFailureMessage({ _tag: "SittingClosed" })).toEqual(
      Option.some("student-closed")
    );
    expect(entryFailureMessage({ _tag: "SittingLocked" })).toEqual(
      Option.some("student-locked-school")
    );
    expect(entryFailureMessage({ _tag: "AttemptClosed" })).toEqual(
      Option.some("student-attempt-closed")
    );
    expect(entryFailureMessage({ _tag: "SecondDevice" })).toEqual(
      Option.some("student-second-device")
    );
    expect(entryFailureMessage({ _tag: "DeviceRetired" })).toEqual(
      Option.some("student-device-retired")
    );
  });

  it("names no sentence for an error that an entry does not name", () => {
    expect(entryFailureMessage({ _tag: "AccessDenied" })).toEqual(
      Option.none()
    );
    expect(entryFailureMessage(new Error("network"))).toEqual(Option.none());
    expect(entryFailureMessage(null)).toEqual(Option.none());
  });
});

describe("entryRefusalMessage", () => {
  it("names the token for a wrong token and the tries for too many tries", () => {
    expect(entryRefusalMessage("TokenRefused")).toBe("student-token-refused");
    expect(entryRefusalMessage("TooManyTries")).toBe("student-too-many-tries");
  });
});
