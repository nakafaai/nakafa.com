import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { estimateThetaEAP } from "@repo/backend/convex/irt/estimation";
import {
  getScaleVersionItems,
  groupScaleVersionItemsBySetId,
} from "@repo/backend/convex/irt/scaleVersions";
import {
  buildIrtResponses,
  computeTryoutRawScorePercentage,
  getFirstCompletedSimulationAttempt,
  syncTryoutAttemptExpiry,
} from "@repo/backend/convex/tryouts/helpers";
import { scaleThetaToTryoutScore } from "@repo/backend/convex/tryouts/products";
import { tryoutStatusValidator } from "@repo/backend/convex/tryouts/schema";
import { ConvexError, type Infer, v } from "convex/values";
import { getManyFrom } from "convex-helpers/server/relationships";

export const completeTryoutResultValidator = v.object({
  status: tryoutStatusValidator,
  isOfficial: v.boolean(),
  theta: v.number(),
  irtScore: v.number(),
  rawScorePercentage: v.number(),
});

type CompleteTryoutResult = Infer<typeof completeTryoutResultValidator>;

/** Finalizes one tryout attempt into its current result state. */
export async function finalizeTryoutAttempt({
  ctx,
  now,
  tryoutAttempt,
  userId,
}: {
  ctx: Pick<MutationCtx, "db" | "scheduler">;
  now: number;
  tryoutAttempt: Doc<"tryoutAttempts">;
  userId: Id<"users">;
}) {
  if (tryoutAttempt.status === "completed") {
    const rawScorePercentage = computeTryoutRawScorePercentage(tryoutAttempt);
    const firstCompletedAttempt = await getFirstCompletedSimulationAttempt(
      ctx.db,
      {
        userId,
        tryoutId: tryoutAttempt.tryoutId,
      }
    );

    return {
      status: "completed",
      isOfficial: firstCompletedAttempt?._id === tryoutAttempt._id,
      theta: tryoutAttempt.theta,
      irtScore: tryoutAttempt.irtScore,
      rawScorePercentage,
    } satisfies CompleteTryoutResult;
  }

  if (tryoutAttempt.status === "expired") {
    return {
      status: "expired",
      isOfficial: false,
      theta: tryoutAttempt.theta,
      irtScore: tryoutAttempt.irtScore,
      rawScorePercentage: computeTryoutRawScorePercentage(tryoutAttempt),
    } satisfies CompleteTryoutResult;
  }

  if (tryoutAttempt.status !== "in-progress") {
    throw new ConvexError({
      code: "INVALID_ATTEMPT_STATUS",
      message: "Tryout attempt is not in progress.",
    });
  }

  const tryoutExpiry = await syncTryoutAttemptExpiry(ctx, tryoutAttempt, now);

  if (tryoutExpiry.expired) {
    return {
      status: "expired",
      isOfficial: false,
      theta: tryoutAttempt.theta,
      irtScore: tryoutAttempt.irtScore,
      rawScorePercentage: computeTryoutRawScorePercentage(tryoutAttempt),
    } satisfies CompleteTryoutResult;
  }

  const [tryout, firstCompletedAttempt] = await Promise.all([
    ctx.db.get("tryouts", tryoutAttempt.tryoutId),
    getFirstCompletedSimulationAttempt(ctx.db, {
      userId,
      tryoutId: tryoutAttempt.tryoutId,
    }),
  ]);

  if (!tryout) {
    throw new ConvexError({
      code: "TRYOUT_NOT_FOUND",
      message: "Tryout not found.",
    });
  }

  const rawScorePercentage = computeTryoutRawScorePercentage(tryoutAttempt);

  if (tryoutAttempt.completedPartIndices.length < tryout.partCount) {
    return {
      status: "in-progress",
      isOfficial: false,
      theta: tryoutAttempt.theta,
      irtScore: tryoutAttempt.irtScore,
      rawScorePercentage,
    } satisfies CompleteTryoutResult;
  }

  const isOfficial = firstCompletedAttempt === null;

  const [partAttempts, scaleVersionItems] = await Promise.all([
    getManyFrom(
      ctx.db,
      "tryoutPartAttempts",
      "tryoutAttemptId_partIndex",
      tryoutAttempt._id,
      "tryoutAttemptId"
    ),
    getScaleVersionItems(ctx.db, tryoutAttempt.scaleVersionId),
  ]);
  const scaleItemsBySetId = groupScaleVersionItemsBySetId(scaleVersionItems);
  const partAttemptData = await Promise.all(
    partAttempts.map(async (partAttempt) => {
      const answers = await ctx.db
        .query("exerciseAnswers")
        .withIndex("attemptId_exerciseNumber", (q) =>
          q.eq("attemptId", partAttempt.setAttemptId)
        )
        .collect();

      return {
        answers,
        itemParamsRecords: scaleItemsBySetId.get(partAttempt.setId) ?? [],
      };
    })
  );
  const allResponses = partAttemptData.flatMap((partData) =>
    buildIrtResponses(partData)
  );
  const { theta, se } = estimateThetaEAP(allResponses);
  const irtScore = scaleThetaToTryoutScore({
    product: tryout.product,
    theta,
  });

  await ctx.db.patch("tryoutAttempts", tryoutAttempt._id, {
    status: "completed",
    completedAt: now,
    theta,
    thetaSE: se,
    irtScore,
    lastActivityAt: now,
  });

  if (isOfficial) {
    await ctx.scheduler.runAfter(
      0,
      internal.tryouts.internalMutations.updateLeaderboard,
      {
        tryoutAttemptId: tryoutAttempt._id,
      }
    );
  }

  return {
    status: "completed",
    isOfficial,
    theta,
    irtScore,
    rawScorePercentage,
  } satisfies CompleteTryoutResult;
}
