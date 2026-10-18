import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { nf } from "@repo/backend/test/editor";
import {
  admittedOf,
  attemptRow,
  deviceOf,
  openedSitting,
  type SittingFixture,
} from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { enter, lock, dashboard, close } = refs.public.exams.sittings;

/** The student's entry with the sitting's token, which must admit the student. */
const enterStudent = (
  fixture: SittingFixture,
  sittingId: GenericId.GenericId<"examSittings">,
  token: string
) =>
  fixture
    .as("student")
    .mutation(enter, {
      deviceId: deviceOf(1),
      sittingId,
      slug: nf,
      token,
    })
    .pipe(Effect.flatMap(admittedOf));

/** The arguments of a proctor's lock on one attempt. */
const lockArgs = (
  attemptId: GenericId.GenericId<"examAttempts">,
  sittingId: GenericId.GenericId<"examSittings">
) => ({
  attemptId,
  reason: "signal-confirmed",
  sittingId,
  slug: nf,
});

/** The arguments of one page of a dashboard. */
const pageArgs = (sittingId: GenericId.GenericId<"examSittings">) => ({
  paginationOpts: { cursor: null, numItems: 10 },
  sittingId,
  slug: nf,
});

describe("exams/sittings authority", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "refuses a proctor action to a student, a principal, and a counselor, by role",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterStudent(fixture, made.id, made.token);
        const byStudent = yield* fixture
          .as("student")
          .mutation(lock, lockArgs(entered.attempt, made.id))
          .pipe(Effect.flip);
        expect(byStudent).toMatchObject({
          _tag: "AccessDenied",
          reason: "role",
        });
        const byPrincipal = yield* fixture
          .as("principal")
          .mutation(lock, lockArgs(entered.attempt, made.id))
          .pipe(Effect.flip);
        expect(byPrincipal).toMatchObject({
          _tag: "AccessDenied",
          reason: "role",
        });
        const byCounselor = yield* fixture
          .as("counselor")
          .query(dashboard, pageArgs(made.id))
          .pipe(Effect.flip);
        expect(byCounselor).toMatchObject({
          _tag: "AccessDenied",
          reason: "role",
        });
      })
  );

  it.effect(
    "lets the Admin proctor the sitting, and the deputy view its dashboard",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterStudent(fixture, made.id, made.token);
        yield* fixture
          .as("admin")
          .mutation(lock, lockArgs(entered.attempt, made.id));
        expect(yield* attemptRow(fixture, entered.attempt)).toMatchObject({
          state: "locked",
        });
        const page = yield* fixture
          .as("deputy")
          .query(dashboard, pageArgs(made.id));
        expect(page.attempts.page).toHaveLength(1);
      })
  );

  it.effect(
    "refuses a proctor action on an attempt that is not in the sitting it names, as a missing object",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterStudent(fixture, made.id, made.token);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("examAttempts").delete(entered.attempt)
          )
        );
        const missing = yield* fixture
          .as("teacher")
          .mutation(lock, lockArgs(entered.attempt, made.id))
          .pipe(Effect.flip);
        expect(missing).toMatchObject({
          _tag: "AccessDenied",
          reason: "resource",
        });
      })
  );

  it.effect(
    "refuses a proctor action on a closed sitting, as a write that is locked",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterStudent(fixture, made.id, made.token);
        yield* fixture
          .as("teacher")
          .mutation(close, { sittingId: made.id, slug: nf });
        const locked = yield* fixture
          .as("teacher")
          .mutation(lock, lockArgs(entered.attempt, made.id))
          .pipe(Effect.flip);
        expect(locked).toMatchObject({
          _tag: "AccessDenied",
          reason: "condition",
        });
      })
  );
});
