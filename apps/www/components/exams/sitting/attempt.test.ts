import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import {
  type AttemptValue,
  finishAttempt,
  isActive,
  secondsLeft,
} from "@/components/exams/sitting/attempt";

const attemptId = Schema.decodeUnknownSync(Id("examAttempts"));

/** An attempt in the given state, with a deadline of ten seconds after its start. */
function attempt(state: AttemptValue["state"]): AttemptValue {
  return {
    deadline: 10_000,
    id: attemptId("attempt-a"),
    startedAt: 0,
    state,
  };
}

describe("secondsLeft", () => {
  it("counts the whole seconds until the deadline", () => {
    expect(secondsLeft(10_000, 4000)).toBe(6);
  });

  it("counts a part of a second as a whole one, so the last second shows", () => {
    expect(secondsLeft(10_000, 9500)).toBe(1);
  });

  it("never goes below zero once the deadline has passed", () => {
    expect(secondsLeft(10_000, 10_000)).toBe(0);
    expect(secondsLeft(10_000, 12_000)).toBe(0);
  });
});

describe("isActive", () => {
  it("is true while the attempt takes answers or a proctor's lock", () => {
    expect(isActive("inProgress")).toBe(true);
    expect(isActive("locked")).toBe(true);
  });

  it("is false once the attempt closes or is submitted", () => {
    expect(isActive("closing")).toBe(false);
    expect(isActive("submitted")).toBe(false);
  });
});

describe("finishAttempt", () => {
  it("submits the attempt and keeps its other fields", () => {
    const finished = finishAttempt(attempt("inProgress"));

    expect(finished.state).toBe("submitted");
    expect(finished.deadline).toBe(10_000);
    expect(finished.id).toBe(attemptId("attempt-a"));
  });
});
