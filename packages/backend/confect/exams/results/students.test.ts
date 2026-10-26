import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { nf } from "@repo/backend/test/editor";
import {
  deviceOf,
  enterOk,
  OPENS_AT,
  openedSitting,
} from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const results = refs.public.exams.results.results;
const { finish, signal } = refs.public.exams.sittings;

/** The device that the test student enters the sitting with. */
const DEVICE = deviceOf(1);

describe("exams/results students", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "shows how many times a submitted student left the exam and the seconds away, as written at submit",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterOk(fixture, {
          deviceId: DEVICE,
          sittingId: made.id,
          token: made.token,
        });
        const send = (kind: "exit" | "return") =>
          fixture.as("student").mutation(signal, {
            attemptId: entered.attempt,
            deviceId: DEVICE,
            kind,
            slug: nf,
          });
        vi.setSystemTime(OPENS_AT + 10_000);
        yield* send("exit");
        vi.setSystemTime(OPENS_AT + 40_000);
        yield* send("return");
        yield* fixture.as("student").mutation(finish, {
          deviceId: DEVICE,
          sittingId: made.id,
          slug: nf,
        });
        const students = yield* fixture.as("teacher").query(results.byStudent, {
          paginationOpts: { cursor: null, numItems: 10 },
          sittingId: made.id,
          slug: nf,
        });
        expect(students.page).toMatchObject([
          { awaySeconds: 30, exits: 1, state: "submitted" },
        ]);
      })
  );

  it.effect(
    "shows no exits and no time away for a submitted attempt without an indication, and none for one in progress",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterOk(fixture, {
          deviceId: DEVICE,
          sittingId: made.id,
          token: made.token,
        });
        const read = () =>
          fixture.as("teacher").query(results.byStudent, {
            paginationOpts: { cursor: null, numItems: 10 },
            sittingId: made.id,
            slug: nf,
          });
        expect((yield* read()).page).toMatchObject([
          { awaySeconds: null, exits: null, state: "inProgress" },
        ]);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("examAttempts")
              .patch(entered.attempt, {
                state: "submitted",
                submittedAt: OPENS_AT,
              })
              .pipe(Effect.orDie)
          )
        );
        expect((yield* read()).page).toMatchObject([
          { awaySeconds: 0, exits: 0, state: "submitted" },
        ]);
      })
  );
});
