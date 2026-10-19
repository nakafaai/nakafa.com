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

const { changeToken, dashboard } = refs.public.exams.sittings;

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
    "says whether the caller may read the results, so the dashboard links to them only to a viewer who may",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const canViewResults = (account: "deputy" | "teacher" | "unitAdmin") =>
          fixture
            .as(account)
            .query(dashboard, {
              paginationOpts: { cursor: null, numItems: 10 },
              sittingId: made.id,
              slug: nf,
            })
            .pipe(Effect.map((page) => page.canViewResults));
        expect(yield* canViewResults("teacher")).toBe(true);
        expect(yield* canViewResults("unitAdmin")).toBe(true);
        expect(yield* canViewResults("deputy")).toBe(false);
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

  it.effect(
    "gives a proctor the sitting's token and every action it may take",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const page = yield* dashboardOf(fixture, made.id);
        expect(page.token).toBe(made.token);
        expect(page.can).toHaveLength(2);
        expect(page.can).toContain("sitting.proctor");
        expect(page.can).toContain("sitting.view");
      })
  );

  it.effect(
    "gives a viewer the sitting without its token, and the view action only",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const page = yield* fixture.as("deputy").query(dashboard, {
          paginationOpts: { cursor: null, numItems: 10 },
          sittingId: made.id,
          slug: nf,
        });
        expect(page.token).toBeNull();
        expect(page.can).toEqual(["sitting.view"]);
      })
  );

  it.effect(
    "shows the sitting with its exam's title and its unit's time zone",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const page = yield* dashboardOf(fixture, made.id);
        expect(page.sitting).toMatchObject({
          examTitle: "PTS",
          id: made.id,
          timeZone: "Asia/Jakarta",
        });
      })
  );

  it.effect(
    "shows the token that a proctor changed, and not the one it replaced",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const changed = yield* fixture.as("teacher").mutation(changeToken, {
          sittingId: made.id,
          slug: nf,
        });
        const page = yield* dashboardOf(fixture, made.id);
        expect(page.token).toBe(changed.token);
        expect(page.token).not.toBe(made.token);
      })
  );

  it.effect(
    "refuses the dashboard of a sitting that no longer exists, as a missing object",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("examSittings").delete(made.id).pipe(Effect.orDie)
          )
        );
        const failure = yield* dashboardOf(fixture, made.id).pipe(Effect.flip);
        expect(failure).toMatchObject({
          _tag: "AccessDenied",
          reason: "resource",
        });
      })
  );
});
