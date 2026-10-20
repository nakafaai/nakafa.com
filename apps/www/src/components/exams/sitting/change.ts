import type { DashboardView } from "@repo/backend/confect/exams/sittings/contract";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr } from "effect";

/** One minute in milliseconds, the unit that a proctor adds to an attempt's deadline. */
const MINUTE_MS = 60_000;

/** The attempts that one dashboard page holds, which is the most that the server returns at once. */
export const DASHBOARD_PAGE_SIZE = 100;

/** The dashboard page as the server answers it, with its sitting and one page of attempts. */
export type DashboardValue = typeof DashboardView.Type;

/** One attempt on the dashboard page. */
export type DashboardAttempt = DashboardValue["attempts"]["page"][number];

/**
 * The arguments of the dashboard query of one page of a sitting's attempts: the first page at
 * `null`, and each later page at the cursor the page before it ended on. The seats and the
 * panel name a page the same way, so they share its subscription.
 */
export function dashboardArgs(
  input: {
    readonly sittingId: DashboardValue["sitting"]["id"];
    readonly slug: TenantSlug;
  },
  cursor: string | null
) {
  return {
    paginationOpts: { cursor, numItems: DASHBOARD_PAGE_SIZE },
    sittingId: input.sittingId,
    slug: input.slug,
  };
}

/**
 * Applies one change to the attempt with this ID and leaves every other attempt as it is.
 * The page is a new value, so the query result that the caller holds stays unchanged.
 */
function changeAttempt(
  value: DashboardValue,
  attemptId: DashboardAttempt["id"],
  change: (attempt: DashboardAttempt) => DashboardAttempt
): DashboardValue {
  return {
    ...value,
    attempts: {
      ...value.attempts,
      page: Arr.map(value.attempts.page, (attempt) =>
        attempt.id === attemptId ? change(attempt) : attempt
      ),
    },
  };
}

/**
 * Locks an attempt in progress, as the server does at once. A locked, closing, or
 * submitted attempt is left as it is, because the table of ADR 0013 does not lock it.
 */
export function lockAttempt(
  value: DashboardValue,
  attemptId: DashboardAttempt["id"]
): DashboardValue {
  return changeAttempt(value, attemptId, (attempt) =>
    attempt.state === "inProgress" ? { ...attempt, state: "locked" } : attempt
  );
}

/**
 * Unlocks a locked attempt. Before its deadline it returns to progress, and after it the
 * attempt closes, which is how the server decides it. Any other state is left as it is.
 */
export function unlockAttempt(
  value: DashboardValue,
  attemptId: DashboardAttempt["id"],
  now: number
): DashboardValue {
  return changeAttempt(value, attemptId, (attempt) => {
    if (attempt.state !== "locked") {
      return attempt;
    }
    return {
      ...attempt,
      state: attempt.deadline > now ? "inProgress" : "closing",
    };
  });
}

/**
 * Moves the deadline of an attempt by whole minutes. Only an attempt in progress or locked
 * before its deadline takes minutes, as the table of ADR 0013 allows.
 */
export function addMinutesToAttempt(
  value: DashboardValue,
  attemptId: DashboardAttempt["id"],
  minutes: number,
  now: number
): DashboardValue {
  return changeAttempt(value, attemptId, (attempt) => {
    const open = attempt.state === "inProgress" || attempt.state === "locked";
    if (!open || attempt.deadline <= now) {
      return attempt;
    }
    return { ...attempt, deadline: attempt.deadline + minutes * MINUTE_MS };
  });
}

/** Marks the sitting closed, as the server does at once. The attempts close later, at their deadlines. */
export function closeSitting(value: DashboardValue): DashboardValue {
  return { ...value, sitting: { ...value.sitting, state: "closed" } };
}
