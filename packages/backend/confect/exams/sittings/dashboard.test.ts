import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { nf } from "@repo/backend/test/editor";
import {
  CLOSES_AT as CLOSES,
  dashboardOf,
  deviceOf,
  enterOk,
  OPENS_AT as OPENS,
  openedSitting,
  seedAttempt,
  seedSignal,
} from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { dashboard } = refs.public.exams.sittings;

describe("exams/sittings dashboard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "shows an unclaimed person's attempt with no animal and no signal",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        yield* seedAttempt(fixture, {
          deadline: CLOSES,
          deviceId: null,
          person: fixture.invited,
          sittingId: made.id,
          state: "locked",
        });
        const page = yield* dashboardOf(fixture, made.id);
        expect(page.attempts.isDone).toBe(true);
        expect(page.attempts.page).toMatchObject([
          {
            away: false,
            latestSignal: null,
            mascot: null,
            name: "Invited",
            state: "locked",
          },
        ]);
      })
  );

  it.effect(
    "keeps the latest signal of an attempt and shows the student back",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        yield* seedSignal(fixture, {
          at: OPENS + 1000,
          attemptId: entered.attempt,
          kind: "disconnect",
        });
        yield* seedSignal(fixture, {
          at: OPENS + 2000,
          attemptId: entered.attempt,
          kind: "return",
        });
        const page = yield* dashboardOf(fixture, made.id);
        expect(page.attempts.page).toMatchObject([
          { away: false, latestSignal: { kind: "return" } },
        ]);
      })
  );

  it.effect(
    "pages the dashboard at one hundred attempts at most, and says that more follow",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        yield* fixture.run(
          Effect.asVoid(
            Effect.forEach(
              Arr.makeBy(101, () => fixture.invited),
              (person) =>
                Effect.flatMap(DatabaseWriter, (writer) =>
                  writer.table("examAttempts").insert({
                    deadline: CLOSES,
                    deviceId: null,
                    person,
                    retiredDeviceIds: [],
                    sitting: made.id,
                    startedAt: OPENS,
                    state: "locked",
                    tenantId: fixture.tenants.nf,
                  })
                )
            )
          )
        );
        const page = yield* fixture.as("teacher").query(dashboard, {
          paginationOpts: { cursor: null, numItems: 500 },
          sittingId: made.id,
          slug: nf,
        });
        expect(page.attempts.page).toHaveLength(100);
        expect(page.attempts.isDone).toBe(false);
      })
  );

  it.effect(
    "refuses the dashboard to a student, who holds no sitting view",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const failure = yield* fixture
          .as("student")
          .query(dashboard, {
            paginationOpts: { cursor: null, numItems: 10 },
            sittingId: made.id,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "AccessDenied", reason: "role" });
      })
  );
});
