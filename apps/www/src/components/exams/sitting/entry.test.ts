import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  entryRefusalMessage,
  failureGroupCopyOf,
  isFinalRefusal,
  refusalCopyOf,
  sittingFailureMessage,
} from "@/components/exams/sitting/entry";

describe("sittingFailureMessage", () => {
  it("names the sentence of each way an entry ends without a seat", () => {
    expect(sittingFailureMessage({ _tag: "NotInSitting" })).toEqual(
      Option.some("student-not-in-sitting")
    );
    expect(sittingFailureMessage({ _tag: "SittingNotOpen" })).toEqual(
      Option.some("student-not-open")
    );
    expect(sittingFailureMessage({ _tag: "SittingClosed" })).toEqual(
      Option.some("student-closed")
    );
    expect(sittingFailureMessage({ _tag: "SittingLocked" })).toEqual(
      Option.some("student-locked-school")
    );
    expect(sittingFailureMessage({ _tag: "AttemptClosed" })).toEqual(
      Option.some("student-attempt-closed")
    );
    expect(sittingFailureMessage({ _tag: "SecondDevice" })).toEqual(
      Option.some("student-second-device")
    );
    expect(sittingFailureMessage({ _tag: "DeviceRetired" })).toEqual(
      Option.some("student-device-retired")
    );
    expect(sittingFailureMessage({ _tag: "AttemptLocked" })).toEqual(
      Option.some("student-locked")
    );
  });

  it("names no sentence for an error that an entry does not name", () => {
    expect(sittingFailureMessage({ _tag: "AccessDenied" })).toEqual(
      Option.none()
    );
    expect(sittingFailureMessage(new Error("network"))).toEqual(Option.none());
    expect(sittingFailureMessage(null)).toEqual(Option.none());
  });

  it("names no sentence for a refusal that only its toast names", () => {
    expect(sittingFailureMessage({ _tag: "ResponseDoesNotFit" })).toEqual(
      Option.none()
    );
    expect(sittingFailureMessage({ _tag: "QuestionNotInExam" })).toEqual(
      Option.none()
    );
  });
});

describe("refusalCopyOf", () => {
  it("names the reason and the next step of each refusal of an answer or a finish", () => {
    expect(refusalCopyOf({ _tag: "AttemptClosed" })).toEqual(
      Option.some({
        description: "sitting-attempt-closed.description",
        title: "sitting-attempt-closed.title",
      })
    );
    expect(refusalCopyOf({ _tag: "AttemptLocked" })).toEqual(
      Option.some({
        description: "sitting-attempt-locked.description",
        title: "sitting-attempt-locked.title",
      })
    );
    expect(refusalCopyOf({ _tag: "ResponseDoesNotFit" })).toEqual(
      Option.some({
        description: "sitting-response-refused.description",
        title: "sitting-response-refused.title",
      })
    );
  });

  it("names no copy for an error that a refusal does not name", () => {
    expect(refusalCopyOf({ _tag: "AccessDenied" })).toEqual(Option.none());
    expect(refusalCopyOf(new Error("network"))).toEqual(Option.none());
  });

  it("names no copy for a sentence that is not a refusal of an answer or a finish", () => {
    expect(refusalCopyOf({ _tag: "SittingClosed" })).toEqual(Option.none());
    expect(refusalCopyOf({ _tag: "SittingNotOpen" })).toEqual(Option.none());
  });
});

describe("isFinalRefusal", () => {
  it("is final for a stale answer, which a newer saved answer already replaced", () => {
    expect(isFinalRefusal({ _tag: "StaleAnswer" })).toBe(true);
  });

  it("is final for a refusal that the server will not take later", () => {
    expect(isFinalRefusal({ _tag: "AttemptClosed" })).toBe(true);
    expect(isFinalRefusal({ _tag: "ResponseDoesNotFit" })).toBe(true);
    expect(isFinalRefusal({ _tag: "SecondDevice" })).toBe(true);
    expect(isFinalRefusal({ _tag: "NotInSitting" })).toBe(true);
  });

  it("is not final for a lock, which lifts and lets the kept answer go through", () => {
    expect(isFinalRefusal({ _tag: "AttemptLocked" })).toBe(false);
    expect(isFinalRefusal({ _tag: "SittingLocked" })).toBe(false);
  });

  it("is not final for an error that is not a refusal", () => {
    expect(isFinalRefusal({ _tag: "SittingClosed" })).toBe(false);
    expect(isFinalRefusal({ _tag: "AccessDenied" })).toBe(false);
    expect(isFinalRefusal(new Error("network"))).toBe(false);
  });
});

describe("stale answer copy", () => {
  it("shows the stale toast for a stale answer, and no sentence on the paper", () => {
    expect(refusalCopyOf({ _tag: "StaleAnswer" })).toEqual(
      Option.some({
        description: "sitting-stale-answer.description",
        title: "sitting-stale-answer.title",
      })
    );
    expect(sittingFailureMessage({ _tag: "StaleAnswer" })).toEqual(
      Option.none()
    );
  });
});

describe("failureGroupCopyOf", () => {
  it("shows the refusal copy of the group's first failure, when it names a refusal", () => {
    expect(
      failureGroupCopyOf([{ _tag: "AttemptClosed" }, new Error("network")])
    ).toEqual(
      Option.some({
        description: "sitting-attempt-closed.description",
        title: "sitting-attempt-closed.title",
      })
    );
  });

  it("shows the generic copy when the group's first failure names no refusal", () => {
    expect(
      failureGroupCopyOf([new Error("network"), { _tag: "AttemptClosed" }])
    ).toEqual(
      Option.some({
        description: "action-error.description",
        title: "action-error.title",
      })
    );
  });

  it("has no copy for a group with no failure", () => {
    expect(failureGroupCopyOf([])).toEqual(Option.none());
  });
});

describe("entryRefusalMessage", () => {
  it("names the token for a wrong token and the tries for too many tries", () => {
    expect(entryRefusalMessage("TokenRefused")).toBe("student-token-refused");
    expect(entryRefusalMessage("TooManyTries")).toBe("student-too-many-tries");
  });
});
