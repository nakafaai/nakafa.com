import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Option, Schema } from "effect";
import {
  addMinutesToAttempt,
  closeSitting,
  DASHBOARD_PAGE_SIZE,
  type DashboardAttempt,
  type DashboardValue,
  dashboardArgs,
  lockAttempt,
  unlockAttempt,
} from "@/components/exams/sitting/change";

const attemptId = Schema.decodeUnknownSync(Id("examAttempts"));
const examId = Schema.decodeUnknownSync(Id("exams"));
const sittingId = Schema.decodeUnknownSync(Id("examSittings"));
const unitId = Schema.decodeUnknownSync(Id("tenantUnits"));

/** One attempt on the page, with its state and deadline and no signal. */
function attempt(
  id: string,
  state: DashboardAttempt["state"],
  deadline: number
): DashboardAttempt {
  return {
    away: false,
    deadline,
    id: attemptId(id),
    latestSignal: null,
    mascot: null,
    name: "Nabila Zahra",
    state,
  };
}

/** A dashboard value with the given attempts on its only page. */
function dashboard(...attempts: DashboardAttempt[]): DashboardValue {
  return {
    attempts: { continueCursor: "", isDone: true, page: attempts },
    sitting: {
      closesAt: 10_000,
      cohortId: null,
      examId: examId("exam-a"),
      id: sittingId("sitting-a"),
      opensAt: 1000,
      room: "Lab 2",
      state: "open",
      unitId: unitId("unit-a"),
    },
  };
}

/** The state of one attempt on the page. */
function stateOf(value: DashboardValue, id: string) {
  return Option.getOrUndefined(
    Arr.findFirst(value.attempts.page, (row) => row.id === attemptId(id))
  )?.state;
}

describe("lockAttempt", () => {
  it("locks an attempt in progress and leaves the others as they are", () => {
    const value = dashboard(
      attempt("a", "inProgress", 10_000),
      attempt("b", "inProgress", 10_000)
    );

    const next = lockAttempt(value, attemptId("a"));

    expect(stateOf(next, "a")).toBe("locked");
    expect(stateOf(next, "b")).toBe("inProgress");
  });

  it("leaves an attempt that the table does not lock, and does not change the page it was given", () => {
    const value = dashboard(
      attempt("locked", "locked", 10_000),
      attempt("closing", "closing", 10_000),
      attempt("done", "submitted", 10_000)
    );

    expect(stateOf(lockAttempt(value, attemptId("locked")), "locked")).toBe(
      "locked"
    );
    expect(stateOf(lockAttempt(value, attemptId("closing")), "closing")).toBe(
      "closing"
    );
    expect(stateOf(lockAttempt(value, attemptId("done")), "done")).toBe(
      "submitted"
    );
    expect(stateOf(value, "locked")).toBe("locked");
  });
});

describe("unlockAttempt", () => {
  it("returns a locked attempt to progress before its deadline", () => {
    const value = dashboard(attempt("a", "locked", 10_000));

    expect(stateOf(unlockAttempt(value, attemptId("a"), 9999), "a")).toBe(
      "inProgress"
    );
  });

  it("closes a locked attempt at its deadline and after it", () => {
    const value = dashboard(attempt("a", "locked", 10_000));

    expect(stateOf(unlockAttempt(value, attemptId("a"), 10_000), "a")).toBe(
      "closing"
    );
    expect(stateOf(unlockAttempt(value, attemptId("a"), 10_001), "a")).toBe(
      "closing"
    );
  });

  it("leaves an attempt that is not locked as it is", () => {
    const value = dashboard(attempt("a", "inProgress", 10_000));

    expect(stateOf(unlockAttempt(value, attemptId("a"), 1), "a")).toBe(
      "inProgress"
    );
  });
});

describe("addMinutesToAttempt", () => {
  it("moves the deadline of an attempt in progress by whole minutes", () => {
    const value = dashboard(attempt("a", "inProgress", 10_000_000));

    const next = addMinutesToAttempt(value, attemptId("a"), 5, 1);

    expect(next.attempts.page[0]?.deadline).toBe(10_000_000 + 5 * 60_000);
  });

  it("moves the deadline of a locked attempt before its deadline", () => {
    const value = dashboard(attempt("a", "locked", 10_000_000));

    const next = addMinutesToAttempt(value, attemptId("a"), 2, 9_999_999);

    expect(next.attempts.page[0]?.deadline).toBe(10_000_000 + 2 * 60_000);
  });

  it("leaves the deadline of an attempt past its deadline, or closing, as it is", () => {
    const value = dashboard(
      attempt("late", "inProgress", 10_000),
      attempt("closing", "closing", 10_000_000)
    );

    const next = addMinutesToAttempt(value, attemptId("late"), 5, 10_000);

    expect(next.attempts.page[0]?.deadline).toBe(10_000);
    expect(
      addMinutesToAttempt(value, attemptId("closing"), 5, 1).attempts.page[1]
        ?.deadline
    ).toBe(10_000_000);
  });
});

describe("closeSitting", () => {
  it("marks the sitting closed and keeps the attempts until their deadlines", () => {
    const value = dashboard(attempt("a", "inProgress", 10_000));

    const next = closeSitting(value);

    expect(next.sitting.state).toBe("closed");
    expect(stateOf(next, "a")).toBe("inProgress");
    expect(value.sitting.state).toBe("open");
  });
});

describe("dashboardArgs", () => {
  it("reads the first page of a sitting's attempts with the sitting and the school", () => {
    const slug = Schema.decodeSync(TenantSlug)("harapan");

    expect(dashboardArgs({ sittingId: sittingId("sitting-a"), slug })).toEqual({
      paginationOpts: { cursor: null, numItems: DASHBOARD_PAGE_SIZE },
      sittingId: sittingId("sitting-a"),
      slug,
    });
  });
});
