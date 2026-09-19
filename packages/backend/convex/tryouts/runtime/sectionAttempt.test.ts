import { describe, expect, it } from "@effect/vitest";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  requireActiveSectionAttempt,
  requireInternalEntrySection,
  startSectionAttempt,
} from "@repo/backend/convex/tryouts/runtime/sectionAttempt";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import { TRYOUT_TEST_NOW as NOW } from "@repo/backend/test/tryouts";
import { Effect } from "effect";

const unavailableSections: Parameters<typeof requireInternalEntrySection>[0] = [
  { sectionKey: "entry", visibility: "visible" },
  { sectionKey: "another", visibility: "internal-entry" },
];

describe("tryouts/runtime/sectionAttempt", () => {
  it.live("accepts the requested internal entry section", () =>
    Effect.gen(function* () {
      const sections: Parameters<typeof requireInternalEntrySection>[0] = [
        { sectionKey: "entry", visibility: "internal-entry" },
      ];

      expect(
        yield* requireInternalEntrySection(sections, "entry")
      ).toBeUndefined();
    })
  );

  it.live.each(unavailableSections)(
    "rejects unavailable entry section $sectionKey",
    (section) =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          requireInternalEntrySection([section], "entry")
        );

        expect(error).toMatchObject({
          _tag: "TryoutRuntimeError",
          code: "TRYOUT_ENTRY_SECTION_NOT_FOUND",
        });
      })
  );
  it.each([
    { kind: "terminal attempt", code: "TRYOUT_ATTEMPT_NOT_ACTIVE" },
    { kind: "expired attempt", code: "TRYOUT_ATTEMPT_NOT_ACTIVE" },
    { kind: "expired section", code: "TRYOUT_SECTION_NOT_ACTIVE" },
    { kind: "terminal section", code: "TRYOUT_SECTION_ALREADY_FINISHED" },
    { kind: "parallel timer", code: "TRYOUT_SECTION_IN_PROGRESS" },
    { kind: "last section expires", code: "TRYOUT_ATTEMPT_NOT_ACTIVE" },
  ])(
    "rejects $kind without publishing a second timer",
    async ({ kind, code }) => {
      const t = createConvexTestWithBetterAuth();
      const fixture = await t.mutation(async (ctx) => {
        const seeded = await seedTryoutContentAccessState(ctx, {
          attemptStatus:
            kind === "terminal attempt" ? "completed" : "in-progress",
          sectionStatus:
            kind === "terminal section" ? "completed" : "in-progress",
          suffix: kind,
        });
        await ctx.db.patch(seeded.attemptId, {
          scoringStrategy: "raw",
          scoreStatus: "official",
          ...(kind === "expired attempt" ? { accessEndsAt: NOW } : {}),
        });
        if (kind === "expired section" || kind === "last section expires") {
          await ctx.db.patch(seeded.sectionAttemptId, { expiresAt: NOW });
        }
        return seeded;
      });
      await expect(
        t.mutation(async (ctx) => {
          const attempt = await ctx.db.get(fixture.attemptId);
          const section = await ctx.db.get(fixture.sectionAttemptId);
          if (!(attempt && section)) {
            throw new Error("Expected a timed attempt.");
          }
          const sectionKey =
            kind === "parallel timer" || kind === "last section expires"
              ? "another-section"
              : section.sectionKey;
          return runConvexProgram(
            startSectionAttempt(ctx, { attempt, now: NOW, sectionKey })
          );
        })
      ).rejects.toMatchObject({ data: { code } });
      const stored = await t.query(async (ctx) => ({
        sections: await ctx.db.query("tryoutSectionAttempts").collect(),
        scores: await ctx.db.query("tryoutScores").collect(),
        jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      }));
      expect(stored.sections).toHaveLength(1);
      expect(stored.scores).toEqual([]);
      expect(stored.jobs).toEqual([]);
    }
  );

  it("requires an active timer and preserves a resumed timer", async () => {
    const t = createConvexTestWithBetterAuth();
    await t.mutation(async (ctx) => {
      const fixture = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        suffix: "resume-timer",
      });
      const attempt = await ctx.db.get(fixture.attemptId);
      const section = await ctx.db.get(fixture.sectionAttemptId);
      if (!(attempt && section)) {
        throw new Error("Expected a timed attempt.");
      }
      expect(
        await runConvexProgram(
          requireActiveSectionAttempt(ctx, {
            attempt,
            sectionKey: section.sectionKey,
          })
        )
      ).toEqual(section);
      expect(
        await runConvexProgram(
          startSectionAttempt(ctx, {
            attempt,
            now: NOW + 1000,
            sectionKey: section.sectionKey,
          })
        )
      ).toEqual({ kind: "started" });
      expect(await ctx.db.get(section._id)).toEqual(section);
      await expect(
        runConvexProgram(
          requireActiveSectionAttempt(ctx, { attempt, sectionKey: "missing" })
        )
      ).rejects.toMatchObject({ data: { code: "TRYOUT_SECTION_NOT_ACTIVE" } });
    });
  });

  it.each(["completed", "in-progress"] as const)(
    "starts the next section after the previous timer is %s",
    async (status) => {
      const t = createConvexTestWithBetterAuth();
      const stored = await t.mutation(async (ctx) => {
        const fixture = await seedTryoutContentAccessState(ctx, {
          attemptStatus: "in-progress",
          sectionStatus: status,
          suffix: `next-timer-${status}`,
        });
        const previous = await ctx.db.get(fixture.attemptId);
        const snapshot = previous?.sectionSnapshots[0];
        if (!(previous && snapshot)) {
          throw new Error("Expected a frozen section.");
        }
        const nextSnapshot = {
          ...snapshot,
          sectionIdentity: "next-section",
          sectionKey: "next",
          sectionOrder: 2,
        };
        await ctx.db.patch(fixture.attemptId, {
          scoringStrategy: "raw",
          scoreStatus: "official",
          sectionSnapshots: [snapshot, nextSnapshot],
          completedSectionKeys:
            status === "completed" ? [snapshot.sectionKey] : [],
          totalQuestions: 2,
        });
        await ctx.db.patch(fixture.sectionAttemptId, { expiresAt: NOW });
        const attempt = await ctx.db.get(fixture.attemptId);
        if (!attempt) {
          throw new Error("Expected a frozen attempt.");
        }
        await runConvexProgram(
          startSectionAttempt(ctx, { attempt, now: NOW, sectionKey: "next" })
        );
        return {
          attempt: await ctx.db.get(fixture.attemptId),
          sections: await ctx.db.query("tryoutSectionAttempts").collect(),
          jobs: await ctx.db.system.query("_scheduled_functions").collect(),
        };
      });
      expect(stored.attempt).toMatchObject({
        status: "in-progress",
        completedSectionKeys: ["penalaran-matematika"],
      });
      expect(stored.sections).toHaveLength(2);
      expect(stored.sections[1]).toMatchObject({
        sectionKey: "next",
        status: "in-progress",
        startedAt: NOW,
      });
      expect(stored.jobs).toHaveLength(1);
    }
  );
});
