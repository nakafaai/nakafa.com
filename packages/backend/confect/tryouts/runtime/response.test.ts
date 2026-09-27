import { afterEach, assert, describe, expect, it } from "@effect/vitest";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { api, internal } from "@repo/backend/convex/_generated/api";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import {
  TRYOUT_SECTION_KEY,
  TRYOUT_TEST_NOW,
} from "@repo/backend/test/tryouts";

afterEach(() => vi.useRealTimers());

describe("tryout response integrity at section submission", () => {
  it.each(["missing", "in-progress"])(
    "preserves the last section when a previously completed section is %s",
    async (previous) => {
      vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
      vi.setSystemTime(TRYOUT_TEST_NOW);
      const t = createConvexTestWithBetterAuth();
      const seeded = await t.mutation(async (ctx) => {
        const fixture = await seedTryoutContentAccessState(ctx, {
          attemptStatus: "in-progress",
          sectionStatus: "in-progress",
          suffix: `completion-${previous}`,
        });
        const attempt = await ctx.db.get(fixture.attemptId);
        const placement = await ctx.db.get(fixture.placementId);
        const section = await ctx.db.get(fixture.sectionAttemptId);
        const first = attempt?.sectionSnapshots[0];
        assert(attempt && placement && section && first);
        const second = {
          ...first,
          sectionIdentity: `${first.sectionIdentity}:second`,
          sectionKey: "second-section",
          sectionOrder: 2,
        };
        await ctx.db.patch(attempt._id, {
          completedSectionKeys: [first.sectionKey],
          scoringStrategy: "raw",
          sectionSnapshots: [first, second],
          totalQuestions: 2,
        });
        await ctx.db.patch(section._id, {
          sectionIdentity: second.sectionIdentity,
          sectionKey: second.sectionKey,
          sectionOrder: second.sectionOrder,
        });
        if (previous === "in-progress") {
          const { _id, _creationTime, ...fields } = section;
          await ctx.db.insert("tryoutSectionAttempts", fields);
        }
        const { _id, _creationTime, ...fields } = placement;
        await ctx.db.insert("tryoutAttemptPlacements", {
          ...fields,
          placementIdentity: `${placement.placementIdentity}:second`,
          sectionIdentity: second.sectionIdentity,
          sectionKey: second.sectionKey,
        });
        return fixture;
      });
      const owner = t.withIdentity({
        sessionId: seeded.identity.sessionId,
        subject: seeded.identity.authUserId,
      });
      const read = () =>
        t.query(async (ctx) => ({
          attempt: await ctx.db.get(seeded.attemptId),
          sections: await ctx.db.query("tryoutSectionAttempts").collect(),
          scores: await ctx.db.query("tryoutScores").collect(),
          progress: await ctx.db.query("tryoutSetProgress").collect(),
        }));
      const before = await read();
      await expect(
        owner.mutation(api.tryouts.mutations.sections.complete, {
          attemptId: seeded.attemptId,
          sectionKey: "second-section",
        })
      ).rejects.toMatchObject({
        data: { code: "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH" },
      });
      expect(await read()).toEqual(before);
    }
  );

  it.each([
    {
      corruption: "section-count",
      code: "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH",
    },
    {
      corruption: "section-snapshot",
      code: "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH",
    },
    { corruption: "placement-snapshot", code: "TRYOUT_RESPONSE_LINK_MISMATCH" },
    { corruption: "placement-order", code: "TRYOUT_PLACEMENT_COUNT_MISMATCH" },
    {
      corruption: "zero-section-count",
      code: "TRYOUT_PLACEMENT_COUNT_MISMATCH",
    },
    {
      corruption: "fractional-section-count",
      code: "TRYOUT_PLACEMENT_COUNT_MISMATCH",
    },
    { corruption: "selection", code: "TRYOUT_RESPONSE_SELECTION_MISMATCH" },
  ])(
    "rejects corrupted $corruption before expiry writes a score",
    async ({ corruption, code }) => {
      vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
      vi.setSystemTime(TRYOUT_TEST_NOW);
      const t = createConvexTestWithBetterAuth();
      const seeded = await t.mutation(async (ctx) => {
        const fixture = await seedTryoutContentAccessState(ctx, {
          attemptStatus: "in-progress",
          sectionStatus: "in-progress",
          suffix: `invalid-${corruption}`,
        });
        await ctx.db.patch(fixture.attemptId, {
          scoringStrategy: "raw",
          expiresAt: TRYOUT_TEST_NOW - 1,
        });
        if (corruption === "section-count") {
          const section = await ctx.db.get(fixture.sectionAttemptId);
          assert(section);
          const { _id, _creationTime, ...fields } = section;
          await ctx.db.insert("tryoutSectionAttempts", {
            ...fields,
            sectionKey: "unexpected-section",
            sectionIdentity: "unexpected-section",
          });
        } else if (corruption === "section-snapshot") {
          await ctx.db.patch(fixture.sectionAttemptId, { sectionOrder: 99 });
        } else if (corruption === "placement-snapshot") {
          await ctx.db.patch(fixture.placementId, {
            sectionIdentity: "unknown-section",
          });
        } else if (corruption === "placement-order") {
          await ctx.db.patch(fixture.placementId, { questionOrder: 0 });
        } else if (
          corruption === "zero-section-count" ||
          corruption === "fractional-section-count"
        ) {
          const attempt = await ctx.db.get(fixture.attemptId);
          const snapshot = attempt?.sectionSnapshots[0];
          assert(attempt && snapshot);
          await ctx.db.patch(attempt._id, {
            sectionSnapshots: [
              {
                ...snapshot,
                questionCount: corruption === "zero-section-count" ? 0 : 0.5,
              },
            ],
          });
        } else {
          await ctx.db.insert("tryoutResponses", {
            answeredAt: TRYOUT_TEST_NOW - 10,
            isComplete: true,
            isCorrect: true,
            placementId: fixture.placementId,
            selection: {
              kind: "single-choice",
              optionKey: "outside-frozen-options",
            },
            timeSpent: 1000,
            tryoutAttemptId: fixture.attemptId,
            tryoutSectionAttemptId: fixture.sectionAttemptId,
            updatedAt: TRYOUT_TEST_NOW - 10,
          });
        }
        return fixture;
      });
      const read = () =>
        t.query(async (ctx) => ({
          attempt: await ctx.db.get(seeded.attemptId),
          sections: await ctx.db.query("tryoutSectionAttempts").collect(),
          scores: await ctx.db.query("tryoutScores").collect(),
          progress: await ctx.db.query("tryoutSetProgress").collect(),
        }));
      const before = await read();
      await expect(
        t.mutation(internal.tryouts.mutations.expiry.attempt, {
          attemptId: seeded.attemptId,
          expiresAt: TRYOUT_TEST_NOW - 1,
        })
      ).rejects.toMatchObject({ data: { code } });
      expect(await read()).toEqual(before);
    }
  );

  it("does not publish an official score for a corrupted zero-question attempt", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(TRYOUT_TEST_NOW);
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const fixture = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        suffix: "zero-question-expiry",
      });
      const attempt = await ctx.db.get(fixture.attemptId);
      const snapshot = attempt?.sectionSnapshots[0];
      assert(attempt && snapshot);
      await ctx.db.patch(attempt._id, {
        scoringStrategy: "raw",
        totalQuestions: 0,
        expiresAt: TRYOUT_TEST_NOW - 1,
        sectionSnapshots: [{ ...snapshot, questionCount: 0 }],
      });
      await ctx.db.patch(fixture.sectionAttemptId, { totalQuestions: 0 });
      await ctx.db.delete(fixture.placementId);
      return fixture;
    });
    await expect(
      t.mutation(internal.tryouts.mutations.expiry.attempt, {
        attemptId: seeded.attemptId,
        expiresAt: TRYOUT_TEST_NOW - 1,
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_PLACEMENT_COUNT_MISMATCH" },
    });
    const state = await t.query(async (ctx) => ({
      attempt: await ctx.db.get(seeded.attemptId),
      scores: await ctx.db.query("tryoutScores").collect(),
      progress: await ctx.db.query("tryoutSetProgress").collect(),
    }));
    expect(state.attempt?.status).toBe("in-progress");
    expect(state.scores).toEqual([]);
    expect(state.progress).toEqual([]);
  });

  it("rejects duplicate placement responses even when the total response count is valid", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(TRYOUT_TEST_NOW);
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const fixture = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        suffix: "duplicate-response-placement",
      });
      const attempt = await ctx.db.get(fixture.attemptId);
      const placement = await ctx.db.get(fixture.placementId);
      const snapshot = attempt?.sectionSnapshots[0];
      assert(attempt && placement && snapshot);
      await ctx.db.patch(attempt._id, {
        scoringStrategy: "raw",
        totalQuestions: 2,
        sectionSnapshots: [{ ...snapshot, questionCount: 2 }],
      });
      await ctx.db.patch(fixture.sectionAttemptId, { totalQuestions: 2 });
      const { _id, _creationTime, ...fields } = placement;
      await ctx.db.insert("tryoutAttemptPlacements", {
        ...fields,
        placementIdentity: `${fields.placementIdentity}:second`,
        questionOrder: 2,
      });
      for (let index = 0; index < 2; index += 1) {
        await ctx.db.insert("tryoutResponses", {
          answeredAt: TRYOUT_TEST_NOW + index,
          isComplete: true,
          isCorrect: true,
          placementId: fixture.placementId,
          selection: { kind: "single-choice", optionKey: "option-1" },
          timeSpent: 1000,
          tryoutAttemptId: fixture.attemptId,
          tryoutSectionAttemptId: fixture.sectionAttemptId,
          updatedAt: TRYOUT_TEST_NOW + index,
        });
      }
      return fixture;
    });
    const before = await t.query(async (ctx) => ({
      attempt: await ctx.db.get(seeded.attemptId),
      section: await ctx.db.get(seeded.sectionAttemptId),
    }));
    const owner = t.withIdentity({
      subject: seeded.identity.authUserId,
      sessionId: seeded.identity.sessionId,
    });
    await expect(
      owner.mutation(api.tryouts.mutations.sections.complete, {
        attemptId: seeded.attemptId,
        sectionKey: TRYOUT_SECTION_KEY,
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_RESPONSE_PLACEMENT_DUPLICATE" },
    });
    const after = await t.query(async (ctx) => ({
      attempt: await ctx.db.get(seeded.attemptId),
      section: await ctx.db.get(seeded.sectionAttemptId),
      progress: await ctx.db.query("tryoutSetProgress").collect(),
      scores: await ctx.db.query("tryoutScores").collect(),
    }));
    expect(after).toEqual({ ...before, progress: [], scores: [] });
  });

  it.each([false, true])(
    "rejects excess responses before scoring or completion, terminal section: %s",
    async (terminal) => {
      vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
      vi.setSystemTime(TRYOUT_TEST_NOW);
      const t = createConvexTestWithBetterAuth();
      const seeded = await t.mutation(async (ctx) => {
        const fixture = await seedTryoutContentAccessState(ctx, {
          attemptStatus: "in-progress",
          sectionStatus: "in-progress",
          suffix: `excess-responses-${terminal}`,
        });
        const attempt = await ctx.db.get(fixture.attemptId);
        const snapshot = attempt?.sectionSnapshots[0];
        assert(attempt && snapshot);
        await ctx.db.patch(attempt._id, {
          scoringStrategy: "raw",
          ...(terminal
            ? {}
            : {
                totalQuestions: 2,
                sectionSnapshots: [
                  snapshot,
                  {
                    ...snapshot,
                    sectionIdentity: `${snapshot.sectionIdentity}:second`,
                    sectionKey: "second-section",
                    sectionOrder: 2,
                  },
                ],
              }),
        });
        for (let index = 0; index < 2; index += 1) {
          await ctx.db.insert("tryoutResponses", {
            answeredAt: TRYOUT_TEST_NOW + index,
            isComplete: true,
            isCorrect: true,
            placementId: fixture.placementId,
            selection: { kind: "single-choice", optionKey: "option-1" },
            timeSpent: 1000,
            tryoutAttemptId: fixture.attemptId,
            tryoutSectionAttemptId: fixture.sectionAttemptId,
            updatedAt: TRYOUT_TEST_NOW + index,
          });
        }
        return fixture;
      });
      const before = await t.query(async (ctx) => ({
        attempt: await ctx.db.get(seeded.attemptId),
        section: await ctx.db.get(seeded.sectionAttemptId),
      }));
      const owner = t.withIdentity({
        subject: seeded.identity.authUserId,
        sessionId: seeded.identity.sessionId,
      });
      await expect(
        owner.mutation(api.tryouts.mutations.sections.complete, {
          attemptId: seeded.attemptId,
          sectionKey: TRYOUT_SECTION_KEY,
        })
      ).rejects.toMatchObject({
        data: { code: "TRYOUT_RESPONSE_COUNT_EXCEEDED" },
      });
      const after = await t.query(async (ctx) => ({
        attempt: await ctx.db.get(seeded.attemptId),
        section: await ctx.db.get(seeded.sectionAttemptId),
        progress: await ctx.db.query("tryoutSetProgress").collect(),
        scores: await ctx.db.query("tryoutScores").collect(),
      }));
      expect(after).toEqual({ ...before, progress: [], scores: [] });
    }
  );
});
