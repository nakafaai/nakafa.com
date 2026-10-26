import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Option, Schema } from "effect";
import {
  type AttemptValue,
  finishAttempt,
  finishInStore,
  isActive,
  secondsLeft,
  takesAnswers,
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

describe("takesAnswers", () => {
  it("is true only while the attempt is in progress, so any other state shows its sentence", () => {
    expect(takesAnswers("inProgress")).toBe(true);
    expect(takesAnswers("locked")).toBe(false);
    expect(takesAnswers("closing")).toBe(false);
    expect(takesAnswers("submitted")).toBe(false);
  });
});

describe("finishInStore", () => {
  const key = {
    sittingId: Schema.decodeUnknownSync(Id("examSittings"))("sitting-a"),
    slug: Schema.decodeSync(TenantSlug)("sekolah"),
  };

  /** A local store that holds `current` for the student's view, and records what is written to it. */
  const storeHolding = (current: Option.Option<unknown>) => {
    const getQuery = vi.fn();
    getQuery.mockReturnValue(current);
    const setQuery = vi.fn();
    return {
      localStore: { getAllQueries: vi.fn(), getQuery, setQuery },
      setQuery,
    };
  };

  it("marks the held attempt submitted and keeps the rest of the student's view", () => {
    const view = { attempt: attempt("inProgress"), sitting: "kept" };
    const { localStore, setQuery } = storeHolding(Option.some(view));

    finishInStore(localStore, key);

    expect(setQuery).toHaveBeenCalledExactlyOnceWith(
      exams.sittings.student,
      key,
      Option.some({ ...view, attempt: attempt("submitted") })
    );
  });

  it("writes nothing for a view without an attempt, or a store without the view", () => {
    for (const current of [
      Option.some({ attempt: null }),
      Option.none(),
    ] as const) {
      const { localStore, setQuery } = storeHolding(current);

      finishInStore(localStore, key);

      expect(setQuery).not.toHaveBeenCalled();
    }
  });
});
