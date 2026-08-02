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
  const placementsByIdentity = getPlacementsByIdentity(args.placements);

  return args.items.map((item): IrtItemAnswer => {
    const itemIdentity = getItemIdentity(item);
    const placement = placementsByIdentity.get(itemIdentity);

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

/** Indexes placement snapshots by their signed or transitional identity. */
function getPlacementsByIdentity(placements: TryoutPlacement[]) {
  const placementsByIdentity = new Map<string, TryoutPlacement>();

  for (const placement of placements) {
    const identity = getPlacementIdentity(placement);
    if (placementsByIdentity.has(identity)) {
      throw new ConvexError({
        code: "TRYOUT_PLACEMENT_DUPLICATE",
        message: "Try-out placement has a duplicate immutable identity.",
      });
    }

    placementsByIdentity.set(identity, placement);
  }

  return placementsByIdentity;
}

/** Returns the immutable join key for one attempt placement. */
function getPlacementIdentity(placement: TryoutPlacement) {
  if (placement.placementIdentity) {
    return `signed:${placement.placementIdentity}`;
  }
  if (placement.questionSourceKey) {
    return `filesystem:${placement.questionSourceKey}`;
  }
  throw new ConvexError({
    code: "TRYOUT_PLACEMENT_IDENTITY_REQUIRED",
    message: "Try-out placement has no immutable identity.",
  });
}

/** Returns the immutable join key for one IRT scale item. */
function getItemIdentity(item: Doc<"irtScaleItems">) {
  if (item.placementIdentity) {
    return `signed:${item.placementIdentity}`;
  }
  if (item.questionSourceKey) {
    return `filesystem:${item.questionSourceKey}`;
  }
  throw new ConvexError({
    code: "TRYOUT_IRT_IDENTITY_REQUIRED",
    message: "IRT scale item has no immutable identity.",
  });
}
