import { assert, describe, expect, it } from "@effect/vitest";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import {
  activateReusedTryoutStartPath,
  activateTryoutStartSource,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_NOW,
  TRYOUT_START_SECTION,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout/source";
import { TRYOUT_SECTION_KEY } from "@repo/backend/test/tryouts";
import { Effect } from "effect";

const setRoute = {
  countryKey: TRYOUT_START_COUNTRY,
  examKey: TRYOUT_START_EXAM,
  locale: "id" as const,
  setKey: TRYOUT_START_SET,
  trackKey: TRYOUT_START_TRACK,
};
describe("tryouts/queries/runtime", () => {
  it("rejects persisted section attempts beyond the frozen inventory", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const fixture = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        suffix: "excess-section-attempts",
      });
      const section = await ctx.db.get(fixture.sectionAttemptId);
      assert(section);
      const { _id, _creationTime, ...fields } = section;
      await ctx.db.insert("tryoutSectionAttempts", {
        ...fields,
        sectionIdentity: "unexpected-section",
        sectionKey: "unexpected-section",
        sectionOrder: 2,
      });
      return fixture;
    });
    const owner = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });
    await expect(
      owner.query(api.tryouts.queries.runtime.getSetAttemptState, {
        locale: "id",
        attemptId: seeded.attemptId,
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_SECTION_ATTEMPT_COUNT_EXCEEDED" },
    });
  });

  it.each(["missing", "hash", "snapshot", "decode"] as const)(
    "does not expose question selectors when the permanent bundle is %s",
    async (corruption) => {
      const t = createConvexTestWithBetterAuth();
      const seeded = await t.mutation(async (ctx) => {
        const fixture = await seedTryoutContentAccessState(ctx, {
          attemptStatus: "in-progress",
          sectionStatus: "in-progress",
          suffix: `bundle-${corruption}`,
        });
        const attempt = await ctx.db.get(fixture.attemptId);
        assert(attempt);
        if (corruption === "missing") {
          await ctx.db.delete(attempt.tryoutBundleId);
        } else if (corruption === "decode") {
          await ctx.db.patch(attempt.tryoutBundleId, { createdAt: Number.NaN });
        } else {
          await ctx.db.patch(
            attempt.tryoutBundleId,
            corruption === "hash"
              ? { bundleHash: "sha256:changed" }
              : { snapshotId: "sha256:changed" }
          );
        }
        return fixture;
      });
      const owner = t.withIdentity({
        sessionId: seeded.identity.sessionId,
        subject: seeded.identity.authUserId,
      });
      await expect(
        owner.query(api.tryouts.queries.runtime.getSectionAttemptState, {
          locale: "id",
          attemptId: seeded.attemptId,
          sectionKey: TRYOUT_SECTION_KEY,
        })
      ).rejects.toMatchObject({ data: { code: "TRYOUT_SELECTOR_INTEGRITY" } });
    }
  );

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
            await activateTryoutStartSource(ctx, "internal-entry", "raw");
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
            locale: "id",
            attemptId: started.attemptId,
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
            await activateTryoutStartSource(ctx, "visible", "raw");
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
        yield* Effect.promise(async () => {
          const args = {
            locale: "id" as const,
            attemptId: started.attemptId,
            sectionKey: TRYOUT_START_SECTION,
          };
          expect(
            await authed.query(
              api.tryouts.queries.runtime.getSectionAttemptState,
              args
            )
          ).toMatchObject({ attempt: { section: null }, runtime: null });
          expect(
            await authed.query(
              api.tryouts.queries.runtime.getSectionAttemptState,
              { ...args, sectionKey: "missing-section" }
            )
          ).toBeNull();
          expect(
            await t.query(api.tryouts.queries.runtime.getSetAttemptState, {
              locale: "id",
              attemptId: started.attemptId,
            })
          ).toBeNull();
          const other = await t.mutation((ctx) =>
            seedAuthenticatedUser(ctx, {
              now: TRYOUT_START_NOW,
              suffix: "unrelated-attempt-reader",
            })
          );
          const outsider = t.withIdentity({
            sessionId: other.sessionId,
            subject: other.authUserId,
          });
          expect(
            await outsider.query(
              api.tryouts.queries.runtime.getSetAttemptState,
              { locale: "id", attemptId: started.attemptId }
            )
          ).toBeNull();
          expect(
            await outsider.query(
              api.tryouts.queries.runtime.getSectionAttemptState,
              args
            )
          ).toBeNull();
        });
        yield* Effect.promise(() =>
          authed.mutation(api.tryouts.mutations.sections.start, {
            attemptId: started.attemptId,
            sectionKey: TRYOUT_START_SECTION,
          })
        );
        const args = {
          locale: "id" as const,
          attemptId: started.attemptId,
          sectionKey: TRYOUT_START_SECTION,
        };

        const initial = yield* Effect.promise(() =>
          authed.query(api.tryouts.queries.runtime.getSectionAttemptState, args)
        );
        expect(initial).toMatchObject({
          attempt: {
            attemptId: started.attemptId,
            section: { sectionKey: TRYOUT_START_SECTION },
          },
          runtime: { questions: expect.any(Array) },
        });
        yield* Effect.promise(() => t.mutation(activateReusedTryoutStartPath));
        expect(
          yield* Effect.promise(() =>
            authed.query(
              api.tryouts.queries.runtime.getSectionAttemptState,
              args
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
