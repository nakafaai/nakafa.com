import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { DeviceId } from "@repo/backend/confect/exams/sittings/schema";
import { Option, Schema } from "effect";
import {
  type Admission,
  answerRefusalOf,
  entryRefusalMessage,
  failureCopyOf,
  failureGroupCopyOf,
  isRetiredDevice,
  refusalCopyOf,
  sittingFailureMessage,
  startEntry,
  stepEntry,
} from "@/components/exams/sitting/entry";

/** An admission at one correction of the device's clock. */
function admission(clockOffset: number): Admission {
  return {
    _tag: "admitted",
    attemptId: Schema.decodeUnknownSync(Id("examAttempts"))("attempt_1"),
    clockOffset,
    deviceId: Schema.decodeSync(DeviceId)(
      "018f3a1e-7c2b-7d4e-9a10-3b5c8f2e6d11"
    ),
    state: "inProgress",
  };
}

const refused: Admission = {
  _tag: "refused",
  message: "student-token-refused",
};

describe("startEntry", () => {
  it("joins a page that holds something to enter with, and an empty token counts", () => {
    expect(startEntry(Option.some("ROOM42"))._tag).toBe("joining");
    expect(startEntry(Option.some(""))._tag).toBe("joining");
  });

  it("waits for a token on a page that holds nothing to enter with", () => {
    expect(startEntry(Option.none())._tag).toBe("waiting");
  });
});

describe("stepEntry", () => {
  it("ends joining on any answer", () => {
    const joining = startEntry(Option.some(""));

    expect(stepEntry(joining, admission(0))).toEqual(admission(0));
    expect(stepEntry(joining, refused)).toEqual(refused);
    expect(stepEntry(joining, { _tag: "failed" })._tag).toBe("failed");
  });

  it("replaces a refusal with the next answer, so a failure says no old sentence", () => {
    const waiting = startEntry(Option.none());

    expect(stepEntry(stepEntry(waiting, refused), admission(0))).toEqual(
      admission(0)
    );
    expect(
      stepEntry(stepEntry(waiting, refused), { _tag: "failed" })._tag
    ).toBe("failed");
  });

  it("keeps an admission through a later refusal or failure, so the paper still shows", () => {
    const admitted = stepEntry(startEntry(Option.none()), admission(5));

    expect(stepEntry(admitted, refused)).toEqual(admission(5));
    expect(stepEntry(admitted, { _tag: "failed" })).toEqual(admission(5));
  });

  it("takes a later admission, whose clock correction is the newer one", () => {
    const admitted = stepEntry(startEntry(Option.none()), admission(5));

    expect(stepEntry(admitted, admission(9))).toEqual(admission(9));
  });
});

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

describe("answerRefusalOf", () => {
  it("is quiet for a stale answer, which the server already holds or a newer one replaced", () => {
    expect(answerRefusalOf({ _tag: "StaleAnswer" })).toBe("quiet");
  });

  it("is final for a refusal that the server will not take later", () => {
    expect(answerRefusalOf({ _tag: "AttemptClosed" })).toBe("final");
    expect(answerRefusalOf({ _tag: "ResponseDoesNotFit" })).toBe("final");
    expect(answerRefusalOf({ _tag: "SecondDevice" })).toBe("final");
    expect(answerRefusalOf({ _tag: "NotInSitting" })).toBe("final");
  });

  it("holds the answer through a lock, which lifts and lets the kept answer go through", () => {
    expect(answerRefusalOf({ _tag: "AttemptLocked" })).toBe("held");
    expect(answerRefusalOf({ _tag: "SittingLocked" })).toBe("held");
  });

  it("is failed for an error that names no refusal of an answer", () => {
    expect(answerRefusalOf({ _tag: "SittingClosed" })).toBe("failed");
    expect(answerRefusalOf({ _tag: "AccessDenied" })).toBe("failed");
    expect(answerRefusalOf(new Error("network"))).toBe("failed");
  });
});

describe("isRetiredDevice", () => {
  it("holds for a device the proctor retired, and for no other refusal or error", () => {
    expect(isRetiredDevice({ _tag: "DeviceRetired" })).toBe(true);
    expect(isRetiredDevice({ _tag: "SecondDevice" })).toBe(false);
    expect(isRetiredDevice(new Error("network"))).toBe(false);
  });
});

describe("stale answer copy", () => {
  it("shows no toast and no sentence for a stale answer, since the paper shows what was saved", () => {
    expect(refusalCopyOf({ _tag: "StaleAnswer" })).toEqual(Option.none());
    expect(sittingFailureMessage({ _tag: "StaleAnswer" })).toEqual(
      Option.none()
    );
  });
});

describe("failureCopyOf", () => {
  it("shows a refusal's own copy, and the generic copy for a failure that names none", () => {
    expect(failureCopyOf({ _tag: "AttemptLocked" })).toEqual({
      description: "sitting-attempt-locked.description",
      title: "sitting-attempt-locked.title",
    });
    expect(failureCopyOf(new Error("network"))).toEqual({
      description: "action-error.description",
      title: "action-error.title",
    });
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
