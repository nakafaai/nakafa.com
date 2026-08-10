import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  readSectionCompletion,
  requireFinalSectionAttempts,
} from "@repo/backend/convex/tryouts/runtime/completion";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout-runtime";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

async function loadCompletionFixture(suffix: string) {
  const t = createConvexTestWithBetterAuth();
  const fixture = await t.mutation(async (ctx) => {
    const seeded = await seedTryoutContentAccessState(ctx, {
      attemptStatus: "in-progress",
      sectionStatus: "in-progress",
      suffix,
    });
    const attempt = await ctx.db.get(seeded.attemptId);
    const section = await ctx.db.get(seeded.sectionAttemptId);
    if (!(attempt && section)) {
      throw new Error("Expected one active try-out completion fixture.");
    }
    return { attempt, section };
  });

  return { ...fixture, t };
}

describe("tryouts/runtime/completion", () => {
  it.each(["duplicate", "foreign"])(
    "rejects %s completed section keys",
    async (kind) => {
      const { attempt, section } = await loadCompletionFixture(
        `completion-${kind}`
      );
      const completedSectionKeys =
        kind === "duplicate"
          ? [section.sectionKey, section.sectionKey]
          : ["foreign-section"];
      const error = Effect.runSync(
        Effect.flip(
          readSectionCompletion({ ...attempt, completedSectionKeys }, section)
        )
      );

      expect(error).toMatchObject({
        _tag: "TryoutResponseIntegrityError",
        code: "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH",
      });
    }
  );

  it("rejects mismatched current section identity and status", async () => {
    const { attempt, section } =
      await loadCompletionFixture("completion-current");
    const identityError = Effect.runSync(
      Effect.flip(
        readSectionCompletion(attempt, {
          ...section,
          sectionIdentity: `${section.sectionIdentity}-foreign`,
        })
      )
    );
    const statusError = Effect.runSync(
      Effect.flip(
        readSectionCompletion(attempt, { ...section, status: "completed" })
      )
    );

    expect(identityError).toMatchObject({
      code: "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH",
    });
    expect(statusError).toMatchObject({ code: "TRYOUT_SECTION_NOT_ACTIVE" });
  });

  it("rejects duplicate snapshot keys before section completion", async () => {
    const { attempt, section } = await loadCompletionFixture(
      "completion-snapshot"
    );
    const firstSnapshot = attempt.sectionSnapshots[0];
    if (!firstSnapshot) {
      throw new Error("Expected one frozen section snapshot.");
    }
    const error = Effect.runSync(
      Effect.flip(
        readSectionCompletion(
          {
            ...attempt,
            sectionSnapshots: [
              firstSnapshot,
              {
                ...firstSnapshot,
                sectionIdentity: `${firstSnapshot.sectionIdentity}-duplicate`,
                sectionOrder: 2,
              },
            ],
          },
          section
        )
      )
    );

    expect(error).toMatchObject({
      code: "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH",
    });
  });

  it("rejects finalization while an earlier completed key is still active", async () => {
    const { attempt, section, t } =
      await loadCompletionFixture("completion-final");
    const finalState = await t.mutation(async (ctx) => {
      const firstSnapshot = attempt.sectionSnapshots[0];
      if (!firstSnapshot) {
        throw new Error("Expected one frozen section snapshot.");
      }
      const finalSnapshot = {
        ...firstSnapshot,
        sectionIdentity: `${firstSnapshot.sectionIdentity}-final`,
        sectionKey: "final-section",
        sectionOrder: 2,
      };
      const finalSectionId = await ctx.db.insert("tryoutSectionAttempts", {
        answeredCount: 0,
        completedAt: null,
        correctAnswers: 0,
        endReason: null,
        expiresAt: section.expiresAt,
        lastActivityAt: section.lastActivityAt,
        sectionIdentity: finalSnapshot.sectionIdentity,
        sectionKey: finalSnapshot.sectionKey,
        sectionOrder: finalSnapshot.sectionOrder,
        startedAt: section.startedAt,
        status: "in-progress",
        totalQuestions: finalSnapshot.questionCount,
        tryoutAttemptId: attempt._id,
      });
      await ctx.db.patch(attempt._id, {
        completedSectionKeys: [section.sectionKey],
        sectionSnapshots: [firstSnapshot, finalSnapshot],
        totalQuestions: 2,
      });
      return {
        attempt: await ctx.db.get(attempt._id),
        finalSection: await ctx.db.get(finalSectionId),
      };
    });
    if (!(finalState.attempt && finalState.finalSection)) {
      throw new Error("Expected one final section completion fixture.");
    }

    expect(
      Effect.runSync(
        readSectionCompletion(finalState.attempt, finalState.finalSection)
      )
    ).toMatchObject({ completesAttempt: true });
    const error = Effect.runSync(
      Effect.flip(
        requireFinalSectionAttempts(
          finalState.attempt,
          finalState.finalSection,
          [section, finalState.finalSection]
        )
      )
    );
    expect(error).toMatchObject({
      code: "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH",
    });
  });
});
