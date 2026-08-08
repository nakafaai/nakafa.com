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
} from "@repo/backend/test/tryout-source";
import { seedTryoutStartSet } from "@repo/backend/test/tryout-start";
import { describe, expect, it, vi } from "vitest";

const setRoute = {
  countryKey: TRYOUT_START_COUNTRY,
  examKey: TRYOUT_START_EXAM,
  locale: "id" as const,
  setKey: TRYOUT_START_SET,
  trackKey: TRYOUT_START_TRACK,
};
const setPublicPath = `try-out/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_TRACK}/${TRYOUT_START_SET}`;
const sectionPublicPath = `${setPublicPath}/${TRYOUT_START_SECTION}`;

describe("tryouts/queries/runtime", () => {
  it("loads an internal entry set through one cohesive runtime query", async () => {
    vi.setSystemTime(new Date(TRYOUT_START_NOW));

    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_START_NOW,
        suffix: "internal-entry-set-state",
      });
      await seedTryoutStartSet(ctx, {
        userId: user.userId,
        visibility: "internal-entry",
      });
      return user;
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const started = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      { ...setRoute, entrySectionKey: TRYOUT_START_SECTION }
    );

    const state = await authed.query(api.tryouts.queries.runtime.getSetState, {
      attemptId: started.attemptId,
      locale: "id",
      publicPath: setPublicPath,
    });

    expect(state).toMatchObject({
      attempt: {
        activeSectionKey: TRYOUT_START_SECTION,
        attemptId: started.attemptId,
        sectionRoutes: [],
      },
      runtime: {
        attemptId: started.attemptId,
        questions: expect.any(Array),
        section: {
          sectionKey: TRYOUT_START_SECTION,
          status: "in-progress",
        },
      },
    });
    expect(state?.runtime?.questions).toHaveLength(1);
  });

  it("keeps explicit state bound to its exact frozen attempt", async () => {
    vi.setSystemTime(new Date(TRYOUT_START_NOW));

    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_START_NOW,
        suffix: "route-bound-attempt",
      });
      await seedTryoutStartSet(ctx, {
        userId: user.userId,
        visibility: "visible",
      });
      return user;
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const frozen = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      { ...setRoute, destinationSectionKey: TRYOUT_START_SECTION }
    );
    await authed.mutation(api.tryouts.mutations.sections.start, {
      attemptId: frozen.attemptId,
      sectionKey: TRYOUT_START_SECTION,
    });
    const latestAttemptId = await t.mutation(async (ctx) => {
      const attempt = await ctx.db.get(frozen.attemptId);
      if (!attempt) {
        throw new Error("Expected the frozen attempt fixture.");
      }
      const { _creationTime, _id, ...fields } = attempt;
      return await ctx.db.insert("tryoutAttempts", {
        ...fields,
        attemptNumber: attempt.attemptNumber + 1,
        lastActivityAt: attempt.lastActivityAt + 1,
        startedAt: attempt.startedAt + 1,
      });
    });

    const latest = await authed.query(api.tryouts.queries.runtime.getSetState, {
      locale: "id",
      publicPath: setPublicPath,
    });
    const exactSet = await authed.query(
      api.tryouts.queries.runtime.getSetState,
      {
        attemptId: frozen.attemptId,
        locale: "id",
        publicPath: setPublicPath,
      }
    );
    const exactSection = await authed.query(
      api.tryouts.queries.runtime.getSectionState,
      {
        attemptId: frozen.attemptId,
        locale: "id",
        publicPath: sectionPublicPath,
      }
    );

    expect(latest?.attempt.attemptId).toBe(latestAttemptId);
    expect(exactSet?.attempt.sectionRoutes).toEqual([
      {
        publicPath: sectionPublicPath,
        questionCount: 1,
        sectionKey: TRYOUT_START_SECTION,
        title: "Matematika",
      },
    ]);
    expect(exactSection).toMatchObject({
      attempt: {
        attemptId: frozen.attemptId,
        section: {
          sectionKey: TRYOUT_START_SECTION,
          status: "in-progress",
        },
      },
      runtime: {
        attemptId: frozen.attemptId,
        questions: expect.any(Array),
      },
    });
    expect(exactSection?.runtime?.questions).toHaveLength(1);

    await t.mutation(activateReusedTryoutStartPath);
    const retained = await authed.query(
      api.tryouts.queries.runtime.getSetState,
      {
        attemptId: frozen.attemptId,
        locale: "id",
        publicPath: setPublicPath,
      }
    );
    expect(retained?.attempt.sectionRoutes).toEqual(
      exactSet?.attempt.sectionRoutes
    );

    await t.mutation(async (ctx) => {
      const attempt = await ctx.db.get(frozen.attemptId);
      if (!attempt) {
        throw new Error("Expected the retained attempt fixture.");
      }
      await ctx.db.patch(frozen.attemptId, {
        sectionSnapshots: attempt.sectionSnapshots.map((snapshot) => ({
          ...snapshot,
          timeLimitSeconds: snapshot.timeLimitSeconds + 1,
        })),
      });
    });
    await expect(
      authed.query(api.tryouts.queries.runtime.getSetState, {
        attemptId: frozen.attemptId,
        locale: "id",
        publicPath: setPublicPath,
      })
    ).rejects.toThrow("TRYOUT_SECTION_SNAPSHOT_MISMATCH");
  });
});
