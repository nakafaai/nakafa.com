import type {
  ExamAttemptsDoc,
  ExamSittingsDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { resultAuthority } from "@repo/backend/confect/exams/results/authority";
import { Sitting } from "@repo/backend/confect/exams/sittings/access";
import { sittingAuthority } from "@repo/backend/confect/exams/sittings/authority";
import { SittingAction } from "@repo/backend/confect/exams/sittings/contract";
import { openToken } from "@repo/backend/confect/exams/sittings/token";
import { sittingView } from "@repo/backend/confect/exams/sittings/view";
import { readTenantKeys } from "@repo/backend/confect/vault/keys";
import type { PaginationOptions } from "convex/server";
import {
  Array as Arr,
  Effect,
  Number as Num,
  Option,
  Schema,
  Struct,
} from "effect";

/** The most attempts that one page of the dashboard holds. A larger request is clamped to it. */
const DASHBOARD_PAGE_SIZE = 100;

/** The animal of a claimed Person, from the account. An unclaimed Person has none. */
export const mascotOf = Effect.fn("exams.sittings.dashboard.mascot")(function* (
  person: TenantPeopleDoc
) {
  if (person.account.state !== "claimed") {
    return null;
  }
  const user = yield* (yield* DatabaseReader)
    .table("users")
    .get(person.account.userId)
    .pipe(Effect.orDie);
  return user.mascot;
});

/**
 * One attempt as the dashboard shows it. The latest signal decides whether the student is
 * away: an exit or a disconnect with no return after it (ADR 0013).
 */
const attemptRow = Effect.fn("exams.sittings.dashboard.attempt")(function* (
  attempt: ExamAttemptsDoc
) {
  const reader = yield* DatabaseReader;
  const person = yield* reader
    .table("tenantPeople")
    .get(attempt.person)
    .pipe(Effect.orDie);
  const mascot = yield* mascotOf(person);
  const latest = yield* reader
    .table("examSignals")
    .index(
      "by_attemptId_and_at",
      (query) => query.eq("attempt", attempt._id),
      "desc"
    )
    .first()
    .pipe(Effect.orDie);
  return {
    away: Option.exists(
      latest,
      (signal) => signal.kind === "exit" || signal.kind === "disconnect"
    ),
    deadline: attempt.deadline,
    id: attempt._id,
    latestSignal: Option.match(latest, {
      onNone: () => null,
      onSome: (signal) => ({ at: signal.at, kind: signal.kind }),
    }),
    mascot,
    name: person.name,
    state: attempt.state,
  };
});

/**
 * The token of a sitting for its proctor. A caller who may only view the sitting gets `null`,
 * so the token is opened only for `sitting.proctor` (ADR 0013, ADR 0030).
 */
const tokenFor = Effect.fn("exams.sittings.dashboard.token")(function* (
  sitting: ExamSittingsDoc,
  actions: readonly string[]
) {
  if (!Arr.contains(actions, "sitting.proctor")) {
    return null;
  }
  const keys = yield* readTenantKeys(sitting.tenantId);
  return yield* openToken(keys, sitting._id, sitting.tokenSealed);
}, Effect.orDie);

/**
 * The proctor's dashboard of a sitting: the sitting, the actions the caller may take on it,
 * its token for a proctor, and one page of its attempts in the order the index holds them.
 * A page asks for at most `DASHBOARD_PAGE_SIZE` attempts, and a larger request is clamped to
 * that size, so every read is bounded (ADR 0013). The sitting's exam is read once, with the
 * sitting, and the actions and the view of the sitting both use that read.
 */
export const dashboard = Effect.fn("exams.sittings.dashboard")(
  function* (args: { paginationOpts: PaginationOptions }) {
    const sitting = yield* Sitting;
    const actions = yield* sittingAuthority.allowed(sitting);
    const resultActions = yield* resultAuthority.allowed(sitting);
    const page = yield* (yield* DatabaseReader)
      .table("examAttempts")
      .index("by_sittingId", (query) => query.eq("sitting", sitting._id))
      .paginate(
        Struct.assign(args.paginationOpts, {
          numItems: Num.clamp(args.paginationOpts.numItems, {
            maximum: DASHBOARD_PAGE_SIZE,
            minimum: 1,
          }),
        })
      )
      .pipe(Effect.orDie);
    const rows = yield* Effect.forEach(page.page, attemptRow, {
      concurrency: "unbounded",
    });
    return {
      attempts: {
        continueCursor: page.continueCursor,
        isDone: page.isDone,
        page: rows,
      },
      can: Arr.filter(actions, Schema.is(SittingAction)),
      canViewResults: Arr.contains(resultActions, "result.view"),
      sitting: yield* sittingView(sitting, sitting.exam),
      token: yield* tokenFor(sitting, actions),
    };
  }
);
