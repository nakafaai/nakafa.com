import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { TryoutRuntimeError } from "@repo/backend/convex/tryouts/runtime/error";
import type { IrtItemAnswer } from "@repo/backend/convex/tryouts/runtime/estimate";
import { estimateIrtScore } from "@repo/backend/convex/tryouts/runtime/estimate";
import { matchesPlacementSnapshot } from "@repo/backend/convex/tryouts/runtime/irt/items";
import { getRawPercentage } from "@repo/backend/convex/tryouts/runtime/result";
import type { TryoutScoringStrategy } from "@repo/backend/convex/tryouts/score";
import { Effect } from "effect";

type TryoutPlacement = Doc<"tryoutAttemptPlacements">;
type TryoutResponse = Doc<"tryoutResponses">;

/** Builds one score result from calibrated items and captured responses. */
export const buildIrtScore = Effect.fn("tryouts.runtime.buildIrtScore")(
  function* (args: {
    items: Doc<"irtScaleItems">[];
    placements: TryoutPlacement[];
    responses: TryoutResponse[];
    scale: Doc<"irtScaleVersions">;
    scoringStrategy: TryoutScoringStrategy;
    totalQuestions: number;
  }) {
    const itemAnswers = yield* loadIrtItemAnswers(args);
    const estimate = yield* estimateIrtScore(itemAnswers);
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
);

/** Joins scale, placement, and response snapshots without source fallbacks. */
const loadIrtItemAnswers = Effect.fn("tryouts.runtime.loadIrtItemAnswers")(
  function* (args: {
    items: Doc<"irtScaleItems">[];
    placements: TryoutPlacement[];
    responses: TryoutResponse[];
  }) {
    if (args.items.length !== args.placements.length) {
      return yield* irtScoreError(
        "TRYOUT_IRT_ITEM_COUNT_MISMATCH",
        "IRT scale item count does not match the placement inventory."
      );
    }

    const responsesByPlacement = new Map(
      args.responses.map((response) => [response.placementId, response])
    );
    const placementsByIdentity = new Map<string, TryoutPlacement>();
    for (const placement of args.placements) {
      if (placementsByIdentity.has(placement.placementIdentity)) {
        return yield* irtScoreError(
          "TRYOUT_PLACEMENT_DUPLICATE",
          "Try-out placement has a duplicate immutable identity."
        );
      }

      placementsByIdentity.set(placement.placementIdentity, placement);
    }

    const itemAnswers: IrtItemAnswer[] = [];
    const itemIdentities = new Set<string>();
    for (const item of args.items) {
      if (itemIdentities.has(item.placementIdentity)) {
        return yield* irtScoreError(
          "TRYOUT_IRT_ITEM_DUPLICATE",
          "IRT scale contains a duplicate placement item."
        );
      }

      const placement = placementsByIdentity.get(item.placementIdentity);

      if (!(placement && matchesPlacementSnapshot(item, placement))) {
        return yield* irtScoreError(
          "TRYOUT_IRT_ITEM_STALE",
          "IRT scale item is missing or stale for one try-out question."
        );
      }

      itemIdentities.add(item.placementIdentity);
      itemAnswers.push({
        isCorrect: Boolean(responsesByPlacement.get(placement._id)?.isCorrect),
        item,
      });
    }

    return itemAnswers;
  }
);

/** Creates one stable typed IRT score failure. */
function irtScoreError(code: string, message: string) {
  return new TryoutRuntimeError({ code, message });
}
