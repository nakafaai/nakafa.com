import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { IrtItemAnswer } from "@repo/backend/convex/tryouts/runtime/estimate";
import { estimateIrtScore } from "@repo/backend/convex/tryouts/runtime/estimate";
import { matchesPlacementSnapshot } from "@repo/backend/convex/tryouts/runtime/irt/items";
import type { AttemptScore } from "@repo/backend/convex/tryouts/runtime/result";
import { getRawPercentage } from "@repo/backend/convex/tryouts/runtime/result";
import type { TryoutScoringStrategy } from "@repo/backend/convex/tryouts/score";
import { ConvexError } from "convex/values";

type TryoutPlacement = Doc<"tryoutAttemptPlacements">;
type TryoutResponse = Doc<"tryoutResponses">;

/** Builds one score result from calibrated items and captured responses. */
export function buildIrtScore(args: {
  items: Doc<"irtScaleItems">[];
  placements: TryoutPlacement[];
  responses: TryoutResponse[];
  scale: Doc<"irtScaleVersions">;
  scoringStrategy: TryoutScoringStrategy;
  totalQuestions: number;
}): AttemptScore {
  const itemAnswers = loadIrtItemAnswers(args);
  const estimate = estimateIrtScore(itemAnswers);
  const correctAnswers = itemAnswers.filter(
    (answer) => answer.isCorrect
  ).length;

  return {
    publishedScore: estimate.publishedScore,
    rawScore: getRawPercentage(correctAnswers, args.totalQuestions),
    scaleVersionId: args.scale._id,
    scoreStatus: args.scale.status,
    scoringStrategy: args.scoringStrategy,
    theta: estimate.theta,
    thetaSE: estimate.thetaSE,
    totalCorrect: correctAnswers,
    totalQuestions: args.totalQuestions,
  };
}

/** Joins scale, placement, and response snapshots without source fallbacks. */
function loadIrtItemAnswers(args: {
  items: Doc<"irtScaleItems">[];
  placements: TryoutPlacement[];
  responses: TryoutResponse[];
}) {
  const responsesByPlacement = new Map(
    args.responses.map((response) => [response.placementId, response])
  );
  const placementsBySourceKey = getPlacementsBySourceKey(args.placements);

  return args.items.map((item): IrtItemAnswer => {
    const placement = placementsBySourceKey.get(item.questionSourceKey);

    if (!(placement && matchesPlacementSnapshot(item, placement))) {
      throw new ConvexError({
        code: "TRYOUT_IRT_ITEM_STALE",
        message: "IRT scale item is missing or stale for one try-out question.",
      });
    }

    return {
      isCorrect: Boolean(responsesByPlacement.get(placement._id)?.isCorrect),
      item,
    };
  });
}

/** Indexes placement snapshots by source key and rejects duplicate rows. */
function getPlacementsBySourceKey(placements: TryoutPlacement[]) {
  const placementsBySourceKey = new Map<string, TryoutPlacement>();

  for (const placement of placements) {
    if (placementsBySourceKey.has(placement.questionSourceKey)) {
      throw new ConvexError({
        code: "TRYOUT_PLACEMENT_DUPLICATE",
        message: "Try-out placement has a duplicate question source key.",
      });
    }

    placementsBySourceKey.set(placement.questionSourceKey, placement);
  }

  return placementsBySourceKey;
}
