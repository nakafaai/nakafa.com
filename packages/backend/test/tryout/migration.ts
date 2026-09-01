import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import type { TryoutResponseSpec } from "@repo/backend/convex/tryouts/response/model";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import { TRYOUT_TEST_NOW } from "@repo/backend/test/tryouts";

type ConvexTest = ReturnType<typeof createConvexTestWithBetterAuth>;

/** Seeds enough predecessor placements to cross the production page boundary. */
export async function seedResponseMigrationFixture(
  t: ConvexTest,
  additional: number
) {
  return await t.mutation(async (ctx) => {
    const seeded = await seedTryoutContentAccessState(ctx, {
      attemptStatus: "in-progress",
      sectionStatus: "in-progress",
      suffix: "response-migration",
    });
    const placement = await ctx.db.get(seeded.placementId);
    if (!placement?.choiceSnapshots) {
      throw new Error("Expected one legacy placement fixture.");
    }
    const selected = requireResponseChoice(placement.choiceSnapshots);
    await insertLegacyResponse(ctx, seeded, {
      isCorrect: selected.isCorrect,
      selectedOptionId: selected.optionKey,
    });

    let canonicalPlacementId: Id<"tryoutAttemptPlacements"> | null = null;
    for (let index = 0; index < additional; index += 1) {
      canonicalPlacementId = await ctx.db.insert("tryoutAttemptPlacements", {
        answerArtifactHash: placement.answerArtifactHash,
        answerContentKey: placement.answerContentKey,
        choiceSnapshots: placement.choiceSnapshots,
        contentHash: placement.contentHash,
        placementIdentity: `${placement.placementIdentity}:migration-${index}`,
        placementRowHash: placement.placementRowHash,
        questionArtifactHash: placement.questionArtifactHash,
        questionContentKey: placement.questionContentKey,
        questionOrder: placement.questionOrder + index + 1,
        rendererDomain: placement.rendererDomain,
        sectionIdentity: placement.sectionIdentity,
        sectionKey: placement.sectionKey,
        sourcePath: placement.sourcePath,
        sourceRevision: placement.sourceRevision,
        tryoutAttemptId: placement.tryoutAttemptId,
      });
    }
    if (!canonicalPlacementId) {
      throw new Error("Expected one copied placement fixture.");
    }
    const responseSpec = singleChoiceResponse(placement.choiceSnapshots);
    await ctx.db.patch(canonicalPlacementId, { responseSpec });
    await ctx.db.insert("tryoutResponses", {
      answeredAt: TRYOUT_TEST_NOW,
      isComplete: true,
      isCorrect: selected.isCorrect,
      placementId: canonicalPlacementId,
      selection: {
        kind: "single-choice",
        optionKey: selected.optionKey,
      },
      timeSpent: 1,
      tryoutAttemptId: seeded.attemptId,
      tryoutSectionAttemptId: seeded.sectionAttemptId,
      updatedAt: TRYOUT_TEST_NOW,
    });
    return { selected };
  });
}

/** Seeds one canonical placement and a deliberately invalid predecessor response. */
export async function seedInvalidResponseMigration(
  t: ConvexTest,
  suffix: string,
  makeResponse: (input: {
    selected: ReturnType<typeof requireResponseChoice>;
  }) => {
    deletePlacement?: boolean;
    isCorrect: boolean;
    selectedOptionId?: string;
  }
) {
  await t.mutation(async (ctx) => {
    const seeded = await seedTryoutContentAccessState(ctx, {
      attemptStatus: "in-progress",
      sectionStatus: "in-progress",
      suffix: `response-migration-${suffix}`,
    });
    const placement = await ctx.db.get(seeded.placementId);
    if (!placement?.choiceSnapshots) {
      throw new Error("Expected one legacy placement fixture.");
    }
    const selected = requireResponseChoice(placement.choiceSnapshots);
    await ctx.db.patch(placement._id, {
      responseSpec: singleChoiceResponse(placement.choiceSnapshots),
    });
    const response = makeResponse({ selected });
    await insertLegacyResponse(ctx, seeded, response);
    if (response.deletePlacement) {
      await ctx.db.delete(placement._id);
    }
  });
}

/** Stores one predecessor response row without canonical selection fields. */
function insertLegacyResponse(
  ctx: MutationCtx,
  seeded: Awaited<ReturnType<typeof seedTryoutContentAccessState>>,
  response: {
    readonly isCorrect: boolean;
    readonly selectedOptionId?: string;
  }
) {
  return ctx.db.insert("tryoutResponses", {
    answeredAt: TRYOUT_TEST_NOW,
    isCorrect: response.isCorrect,
    placementId: seeded.placementId,
    selectedOptionId: response.selectedOptionId,
    timeSpent: 1,
    tryoutAttemptId: seeded.attemptId,
    tryoutSectionAttemptId: seeded.sectionAttemptId,
    updatedAt: TRYOUT_TEST_NOW,
  });
}

/** Returns one deterministic option from a predecessor response definition. */
export function requireResponseChoice(
  choices: NonNullable<Doc<"tryoutAttemptPlacements">["choiceSnapshots"]>
) {
  const selected = choices.at(0);
  if (!selected) {
    throw new Error("Expected one frozen response option.");
  }
  return selected;
}

/** Converts fixture choices to the exact canonical single-choice contract. */
export function singleChoiceResponse(
  choices: Parameters<typeof requireResponseChoice>[0]
): TryoutResponseSpec {
  return { kind: "single-choice", options: [...choices] };
}

/** Reads persisted rows and migration jobs for end-to-end assertions. */
export async function readResponseMigrationState(t: ConvexTest) {
  return await t.query(async (ctx) => ({
    jobs: await ctx.db.system.query("_scheduled_functions").collect(),
    placements: await ctx.db.query("tryoutAttemptPlacements").collect(),
    responses: await ctx.db.query("tryoutResponses").collect(),
  }));
}
