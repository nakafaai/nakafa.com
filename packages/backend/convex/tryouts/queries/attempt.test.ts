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

const route = { ...setRoute, sectionKey: TRYOUT_START_SECTION };
const setPublicPath = `try-out/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_TRACK}/${TRYOUT_START_SET}`;
const sectionPublicPath = `${setPublicPath}/${TRYOUT_START_SECTION}`;

describe("tryouts/queries/attempt", () => {
  it("keeps a frozen route bound to its exact attempt", async () => {
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

    const latest = await authed.query(
      api.tryouts.queries.attempt.getCurrent,
      route
    );
    const exact = await authed.query(api.tryouts.queries.attempt.getCurrent, {
      ...route,
      attemptId: frozen.attemptId,
    });
    const runtime = await authed.query(api.tryouts.queries.runtime.getSection, {
      ...route,
      attemptId: frozen.attemptId,
    });

    expect(latest?.attemptId).toBe(latestAttemptId);
    expect(exact?.attemptId).toBe(frozen.attemptId);
    expect(exact?.sectionRoutes).toEqual([
      {
        publicPath: sectionPublicPath,
        questionCount: 1,
        sectionKey: TRYOUT_START_SECTION,
        title: "Matematika",
      },
    ]);
    expect(runtime?.attemptId).toBe(frozen.attemptId);
    expect(runtime?.questions).toHaveLength(1);

    await t.mutation((ctx) =>
      ctx.db.patch(latestAttemptId, {
        completedAt: TRYOUT_START_NOW + 1,
        endReason: "submitted",
        status: "completed",
      })
    );
    await expect(
      authed.query(api.tryouts.queries.attempt.getCurrent, route)
    ).resolves.toBeNull();
    await expect(
      authed.query(api.tryouts.queries.runtime.getSection, route)
    ).resolves.toBeNull();

    await t.mutation(activateReusedTryoutStartPath);
    const retained = await authed.query(
      api.tryouts.queries.attempt.getCurrent,
      {
        ...route,
        attemptId: frozen.attemptId,
      }
    );
    expect(retained?.sectionRoutes).toEqual(exact?.sectionRoutes);

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
      authed.query(api.tryouts.queries.attempt.getCurrent, {
        ...route,
        attemptId: frozen.attemptId,
      })
    ).rejects.toThrow("TRYOUT_SECTION_SNAPSHOT_MISMATCH");

    await expect(
      authed.query(api.tryouts.queries.attempt.getCurrentByPublicPath, {
        locale: "id",
        publicPath: setPublicPath,
      })
    ).resolves.toBeNull();
  });
});
