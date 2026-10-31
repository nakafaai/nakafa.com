import { describe, expect, it } from "@effect/vitest";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { catalogNodeIdentity } from "@repo/backend/confect/tryouts/catalog/rows";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  insertPolarAccount,
  insertProSubscription,
} from "@repo/backend/test/billing";
import { client } from "@repo/backend/test/client";
import {
  startArgs,
  TRYOUT_NOW,
  type TryoutWorld,
  tryoutWorld,
} from "@repo/backend/test/tryout/world";
import { Array as Arr, Effect } from "effect";

const DAY = 86_400_000;

/** Reads one attempt with its places, section attempts, progress, and scheduled expiry. */
const readStart = (world: TryoutWorld, attemptId: Id<"tryoutAttempts">) =>
  Effect.promise(() =>
    world.t.query(async (ctx) => ({
      attempt: await ctx.db.get("tryoutAttempts", attemptId),
      placements: await ctx.db
        .query("tryoutAttemptPlacements")
        .withIndex(
          "by_tryoutAttemptId_and_sectionKey_and_questionOrder",
          (query) => query.eq("tryoutAttemptId", attemptId)
        )
        .collect(),
      progress: await ctx.db.query("tryoutSetProgress").collect(),
      scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
      sections: await ctx.db
        .query("tryoutSectionAttempts")
        .withIndex("by_tryoutAttemptId_and_sectionOrder", (query) =>
          query.eq("tryoutAttemptId", attemptId)
        )
        .collect(),
    }))
  );

describe("tryouts/mutations/attempts", () => {
  it.effect(
    "freezes a visible set from the active snapshot into an attempt, its places, its progress, and its expiry",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const started = yield* world.start();
        expect(started.navigation).toEqual({
          publicPath: "try-out/indonesia/snbt/2027/set-1-id",
        });
        const { attempt, placements, progress, scheduled, sections } =
          yield* readStart(world, started.attemptId);
        expect(attempt).toMatchObject({
          appLocale: "id",
          assessmentSnapshotId: world.snapshotId,
          attemptNumber: 1,
          expiresAt: TRYOUT_NOW + 3 * DAY,
          paper: { id: "test-paper-set-1" },
          profile: { id: "test-profile" },
          scoreStatus: "official",
          scoring: { kind: "raw" },
          sections: [
            {
              publicPath: "try-out/indonesia/snbt/2027/set-1-id/section-a",
              questionCount: 2,
              sectionKey: "section-a",
              sectionOrder: 1,
              timeLimitSeconds: 600,
            },
            {
              publicPath: "try-out/indonesia/snbt/2027/set-1-id/section-b",
              questionCount: 1,
              sectionKey: "section-b",
              sectionOrder: 2,
              timeLimitSeconds: 300,
            },
          ],
          setIdentity: "indonesia/snbt/2027/set-1",
          setPublicPath: "try-out/indonesia/snbt/2027/set-1-id",
          status: "in-progress",
          totalQuestions: 3,
        });
        expect(
          Arr.map(
            placements,
            ({ family, questionOrder, rule, sectionKey }) => ({
              family,
              questionOrder,
              rule,
              sectionKey,
            })
          )
        ).toEqual([
          {
            family: "section-a-item-1",
            questionOrder: 1,
            rule: { kind: "allOrNothing" },
            sectionKey: "section-a",
          },
          {
            family: "section-a-item-2",
            questionOrder: 2,
            rule: { kind: "allOrNothing" },
            sectionKey: "section-a",
          },
          {
            family: "section-b-item-1",
            questionOrder: 1,
            rule: { kind: "allOrNothing" },
            sectionKey: "section-b",
          },
        ]);
        expect(sections).toEqual([]);
        expect(progress).toMatchObject([
          { latestAttemptId: started.attemptId, status: "in-progress" },
        ]);
        expect(scheduled).toContainEqual(
          expect.objectContaining({
            args: [
              {
                attemptId: started.attemptId,
                expiresAt: TRYOUT_NOW + 3 * DAY,
              },
            ],
            scheduledTime: TRYOUT_NOW + 3 * DAY,
          })
        );
      })
  );

  it.effect(
    "starts a direct-entry set in its entry section and resumes the same attempt",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld({ entry: true });
        const started = yield* world.start({ entry: true });
        expect(yield* world.start({ entry: true })).toEqual(started);
        const { attempt, sections } = yield* readStart(
          world,
          started.attemptId
        );
        expect(attempt?.sections).toEqual([
          {
            questionCount: 2,
            sectionKey: "section-a",
            sectionOrder: 1,
            timeLimitSeconds: 600,
          },
        ]);
        expect(sections).toMatchObject([
          { sectionKey: "section-a", status: "in-progress", totalQuestions: 2 },
        ]);
      })
  );

  it.effect(
    "resumes a direct-entry attempt in its first unfinished entry when the requested entry is not frozen",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld({ entry: true });
        const started = yield* world.start();
        expect((yield* readStart(world, started.attemptId)).sections).toEqual(
          []
        );
        const resumed = yield* world.learner.mutation(
          tryouts.mutations.attempts.startAttempt,
          { ...startArgs(), entrySectionKey: "renamed-entry" }
        );
        expect(resumed).toEqual(started);
        expect(
          (yield* readStart(world, started.attemptId)).sections
        ).toMatchObject([{ sectionKey: "section-a", status: "in-progress" }]);
      })
  );

  it.effect(
    "resumes a visible attempt without starting a section for an entry key",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const started = yield* world.start();
        expect(
          yield* world.learner.mutation(
            tryouts.mutations.attempts.startAttempt,
            {
              ...startArgs(),
              entrySectionKey: "section-a",
            }
          )
        ).toEqual(started);
        expect((yield* readStart(world, started.attemptId)).sections).toEqual(
          []
        );
      })
  );

  it.effect(
    "navigates to a frozen section, in another locale through the attempt's snapshot, and refuses one it lacks",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const toSection = (
          locale: "en" | "id",
          destinationSectionKey: string
        ) =>
          world.learner.mutation(tryouts.mutations.attempts.startAttempt, {
            ...startArgs({ locale }),
            destinationSectionKey,
          });
        expect((yield* toSection("id", "section-b")).navigation).toEqual({
          publicPath: "try-out/indonesia/snbt/2027/set-1-id/section-b",
        });
        expect((yield* toSection("en", "section-b")).navigation).toEqual({
          publicPath: "try-out/indonesia/snbt/2027/set-1-en/section-b",
        });
        expect(
          yield* toSection("id", "section-z").pipe(Effect.flip)
        ).toMatchObject({
          code: "TRYOUT_SECTION_SNAPSHOT_MISMATCH",
          message: expect.stringContaining("frozen sections"),
        });
        yield* world.replaceRow(
          "catalog",
          catalogNodeIdentity({
            appLocale: "en",
            countryKey: "indonesia",
            examKey: "snbt",
            kind: "section",
            sectionKey: "section-b",
            setKey: "set-1",
            trackKey: "2027",
          }),
          ""
        );
        expect(
          yield* toSection("en", "section-b").pipe(Effect.flip)
        ).toMatchObject({
          code: "TRYOUT_SECTION_SNAPSHOT_MISMATCH",
          message: expect.stringContaining("in this language"),
        });
      })
  );

  it.effect(
    "navigates a resumed attempt to its set in another locale of its snapshot, and refuses a locale that lost it",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        yield* world.start();
        expect((yield* world.start({ locale: "en" })).navigation).toEqual({
          publicPath: "try-out/indonesia/snbt/2027/set-1-en",
        });
        yield* world.replaceRow(
          "catalog",
          catalogNodeIdentity({
            appLocale: "de",
            countryKey: "indonesia",
            examKey: "snbt",
            kind: "set",
            setKey: "set-1",
            trackKey: "2027",
          }),
          ""
        );
        expect(
          yield* world.start({ locale: "de" }).pipe(Effect.flip)
        ).toMatchObject({ code: "TRYOUT_SECTION_SNAPSHOT_MISMATCH" });
      })
  );

  it.effect("refuses a resumed attempt whose frozen set route is lost", () =>
    Effect.gen(function* () {
      const world = yield* tryoutWorld();
      const started = yield* world.start();
      yield* Effect.promise(() =>
        world.t.mutation((ctx) =>
          ctx.db.patch("tryoutAttempts", started.attemptId, {
            setPublicPath: "",
          })
        )
      );
      expect(yield* world.start().pipe(Effect.flip)).toMatchObject({
        code: "TRYOUT_SECTION_SNAPSHOT_MISMATCH",
      });
    })
  );

  it.effect(
    "expires and scores a lapsed attempt before opening the next one",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const first = yield* world.start();
        yield* Effect.promise(() =>
          world.t.mutation((ctx) =>
            ctx.db.patch("tryoutAttempts", first.attemptId, {
              expiresAt: TRYOUT_NOW,
            })
          )
        );
        const second = yield* world.start();
        expect(second.attemptId).not.toBe(first.attemptId);
        const rows = yield* Effect.promise(() =>
          world.t.query(async (ctx) => ({
            first: await ctx.db.get("tryoutAttempts", first.attemptId),
            score: await ctx.db
              .query("tryoutScores")
              .withIndex("by_tryoutAttemptId", (query) =>
                query.eq("tryoutAttemptId", first.attemptId)
              )
              .unique(),
            second: await ctx.db.get("tryoutAttempts", second.attemptId),
          }))
        );
        expect(rows.first).toMatchObject({ status: "expired" });
        expect(rows.score).toMatchObject({
          assessmentSnapshotId: world.snapshotId,
          totalCorrect: 0,
          totalQuestions: 3,
        });
        expect(rows.second).toMatchObject({
          accessSourceKind: "free",
          attemptNumber: 2,
          status: "in-progress",
        });
      })
  );

  it.effect("records an active subscription as the attempt's access", () =>
    Effect.gen(function* () {
      const world = yield* tryoutWorld();
      const periodEnd = TRYOUT_NOW + 60_000;
      const subscriptionId = yield* Effect.promise(() =>
        world.t.mutation(async (ctx) => {
          const accountId = await insertPolarAccount(ctx, world.userId);
          return await insertProSubscription(ctx, accountId, {
            currentPeriodEnd: periodEnd,
            subscriptionId: "tryout-subscription",
          });
        })
      );
      const started = yield* world.start();
      expect(
        (yield* readStart(world, started.attemptId)).attempt
      ).toMatchObject({
        accessEndsAt: periodEnd,
        accessSourceKind: "subscription",
        accessSubscriptionId: subscriptionId,
        expiresAt: TRYOUT_NOW + 3 * DAY,
      });
    })
  );

  it.effect("freezes a penalized profile's marks with the attempt", () =>
    Effect.gen(function* () {
      const marks = { blank: 0, correct: 4, wrong: -1 };
      const world = yield* tryoutWorld({
        scoring: { kind: "penalized", marks },
      });
      const started = yield* world.start();
      expect(
        (yield* readStart(world, started.attemptId)).attempt?.scoring
      ).toEqual({ kind: "penalized", marks });
    })
  );

  it.effect(
    "refuses a start before any release activates an assessment snapshot",
    () =>
      Effect.gen(function* () {
        vi.setSystemTime(TRYOUT_NOW);
        const t = createConvexTestWithBetterAuth();
        const learner = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            seedAuthenticatedUser(ctx, { now: TRYOUT_NOW, suffix: "early" })
          )
        );
        const refused = yield* client(
          t.withIdentity({
            sessionId: learner.sessionId,
            subject: learner.authUserId,
          })
        )
          .mutation(tryouts.mutations.attempts.startAttempt, startArgs())
          .pipe(Effect.flip);
        expect(refused).toMatchObject({
          _tag: "ReleaseError",
          code: "CONTENT_RELEASE_MISSING",
        });
      })
  );

  it.effect(
    "refuses a set the active release does not publish in that locale, and an entry the set does not hold",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        expect(
          yield* world.start({ setKey: "set-9" }).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "ReleaseError",
          code: "CONTENT_RELEASE_MISSING",
        });
        expect(
          yield* world.start({ entry: true }).pipe(Effect.flip)
        ).toMatchObject({ code: "TRYOUT_ENTRY_SECTION_NOT_FOUND" });
      })
  );
});
