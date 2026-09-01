import { describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import {
  activateReusedTryoutStartPath,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_NOW,
  TRYOUT_START_SECTION,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout/source";
import { seedTryoutStartSet } from "@repo/backend/test/tryout/start";
import { Effect } from "effect";

const setRoute = {
  countryKey: TRYOUT_START_COUNTRY,
  examKey: TRYOUT_START_EXAM,
  locale: "id" as const,
  setKey: TRYOUT_START_SET,
  trackKey: TRYOUT_START_TRACK,
};
describe("tryouts/queries/runtime", () => {
  it.effect(
    "keeps exact live state compact and skips score reads while active",
    () =>
      Effect.gen(function* () {
        yield* Effect.sync(() => vi.setSystemTime(new Date(TRYOUT_START_NOW)));

        const t = createConvexTestWithBetterAuth();
        const identity = yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const user = await seedAuthenticatedUser(ctx, {
              now: TRYOUT_START_NOW,
              suffix: "exact-active-state",
            });
            await seedTryoutStartSet(ctx, {
              userId: user.userId,
              visibility: "internal-entry",
            });
            return user;
          })
        );
        const authed = t.withIdentity({
          sessionId: identity.sessionId,
          subject: identity.authUserId,
        });
        const started = yield* Effect.promise(() =>
          authed.mutation(api.tryouts.mutations.attempts.startAttempt, {
            ...setRoute,
            entrySectionKey: TRYOUT_START_SECTION,
          })
        );

        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const attempt = await ctx.db.get(started.attemptId);
            if (!attempt) {
              throw new Error("Expected one active attempt.");
            }
            for (const offset of [0, 1]) {
              await ctx.db.insert("tryoutScores", {
                finalizedAt: TRYOUT_START_NOW + offset,
                publishedScore: 0,
                rawScore: 0,
                scoreStatus: "official",
                scoringStrategy: "raw",
                setIdentity: attempt.setIdentity,
                totalCorrect: 0,
                totalQuestions: attempt.totalQuestions,
                tryoutAttemptId: attempt._id,
                tryoutSnapshotId: attempt.tryoutSnapshotId,
                userId: attempt.userId,
              });
            }
          })
        );

        const exact = yield* Effect.promise(() =>
          authed.query(api.tryouts.queries.runtime.getSetAttemptState, {
            attemptId: started.attemptId,
            responseContract: "structured",
          })
        );
        expect(exact).toMatchObject({
          attempt: {
            activeSectionKey: TRYOUT_START_SECTION,
            attemptId: started.attemptId,
            score: null,
          },
          runtime: {
            questions: expect.any(Array),
            section: { status: "in-progress" },
          },
        });
        expect(exact?.attempt).not.toHaveProperty("lastActivityAt");
        expect(exact?.attempt).not.toHaveProperty("sectionRoutes");
        expect(exact?.attempt).not.toHaveProperty("totalQuestions");
        expect(exact?.runtime?.questions.at(0)).not.toHaveProperty("title");
      })
  );

  it.effect(
    "binds exact section state to ownership instead of the active catalog",
    () =>
      Effect.gen(function* () {
        yield* Effect.sync(() => vi.setSystemTime(new Date(TRYOUT_START_NOW)));

        const t = createConvexTestWithBetterAuth();
        const identity = yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const user = await seedAuthenticatedUser(ctx, {
              now: TRYOUT_START_NOW,
              suffix: "exact-section-state",
            });
            await seedTryoutStartSet(ctx, {
              userId: user.userId,
              visibility: "visible",
            });
            return user;
          })
        );
        const authed = t.withIdentity({
          sessionId: identity.sessionId,
          subject: identity.authUserId,
        });
        const started = yield* Effect.promise(() =>
          authed.mutation(api.tryouts.mutations.attempts.startAttempt, {
            ...setRoute,
            destinationSectionKey: TRYOUT_START_SECTION,
          })
        );
        yield* Effect.promise(() =>
          authed.mutation(api.tryouts.mutations.sections.start, {
            attemptId: started.attemptId,
            sectionKey: TRYOUT_START_SECTION,
          })
        );
        const args = {
          attemptId: started.attemptId,
          sectionKey: TRYOUT_START_SECTION,
        };
        const structuredArgs = {
          ...args,
          responseContract: "structured" as const,
        };

        const initial = yield* Effect.promise(() =>
          authed.query(
            api.tryouts.queries.runtime.getSectionAttemptState,
            structuredArgs
          )
        );
        expect(initial).toMatchObject({
          attempt: {
            attemptId: started.attemptId,
            section: { sectionKey: TRYOUT_START_SECTION },
          },
          runtime: { questions: expect.any(Array) },
        });
        expect(
          yield* Effect.promise(() =>
            authed.query(
              api.tryouts.queries.runtime.getSectionAttemptState,
              args
            )
          )
        ).toEqual(initial);

        yield* Effect.promise(() => t.mutation(activateReusedTryoutStartPath));
        expect(
          yield* Effect.promise(() =>
            authed.query(
              api.tryouts.queries.runtime.getSectionAttemptState,
              structuredArgs
            )
          )
        ).toEqual(initial);
        expect(
          yield* Effect.promise(() =>
            t.query(api.tryouts.queries.runtime.getSectionAttemptState, args)
          )
        ).toBeNull();
      })
  );
});
