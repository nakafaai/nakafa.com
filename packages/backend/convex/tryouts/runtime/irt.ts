import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { TryoutIrtSource } from "@repo/backend/convex/tryouts/runtime/irt/items";
import { buildIrtScore } from "@repo/backend/convex/tryouts/runtime/irt/score";
import type { TryoutScoringStrategy } from "@repo/backend/convex/tryouts/score";
import { Effect } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutPlacement = Doc<"tryoutAttemptPlacements">;
type TryoutResponse = Doc<"tryoutResponses">;

/** Scores an IRT attempt from one validated placement inventory. */
export const scoreIrtAttempt = Effect.fn("tryouts.runtime.scoreIrtAttempt")(
  function* (args: {
    attempt: TryoutAttempt;
    placements: TryoutPlacement[];
    responses: TryoutResponse[];
    scoringStrategy: TryoutScoringStrategy;
    source: TryoutIrtSource;
  }) {
    return yield* buildIrtScore({
      items: args.source.items,
      placements: args.placements,
      responses: args.responses,
      scale: args.source.scale,
      scoringStrategy: args.scoringStrategy,
      totalQuestions: args.attempt.totalQuestions,
    });
  }
);

/** Scores one IRT section from one validated placement inventory. */
export const scoreIrtSection = Effect.fn("tryouts.runtime.scoreIrtSection")(
  function* (args: {
    placements: TryoutPlacement[];
    responses: TryoutResponse[];
    scoringStrategy: TryoutScoringStrategy;
    source: TryoutIrtSource;
    totalQuestions: number;
  }) {
    const placementIdentities = new Set(
      args.placements.map((placement) => placement.placementIdentity)
    );
    const items = args.source.items.filter((item) =>
      placementIdentities.has(item.placementIdentity)
    );

    return yield* buildIrtScore({
      items,
      placements: args.placements,
      responses: args.responses,
      scale: args.source.scale,
      scoringStrategy: args.scoringStrategy,
      totalQuestions: args.totalQuestions,
    });
  }
);
