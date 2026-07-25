import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  loadAttemptPlacements,
  loadAttemptScale,
  loadAttemptScaleItems,
  loadSectionPlacements,
  loadSectionScaleItems,
} from "@repo/backend/convex/tryouts/runtime/irt/items";
import { buildIrtScore } from "@repo/backend/convex/tryouts/runtime/irt/score";
import type { AttemptScore } from "@repo/backend/convex/tryouts/runtime/result";
import type { TryoutScoringStrategy } from "@repo/backend/convex/tryouts/score";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutResponse = Doc<"tryoutResponses">;

/** Scores an entire IRT attempt from its immutable scale and placement snapshots. */
export async function scoreIrtAttempt(
  ctx: MutationCtx,
  args: {
    attempt: TryoutAttempt;
    responses: TryoutResponse[];
    scoringStrategy: TryoutScoringStrategy;
  }
): Promise<AttemptScore> {
  const scale = await loadAttemptScale(ctx, args.attempt);
  const [items, placements] = await Promise.all([
    loadAttemptScaleItems(ctx, scale, args.attempt.totalQuestions),
    loadAttemptPlacements(ctx, args.attempt),
  ]);

  return buildIrtScore({
    items,
    placements,
    responses: args.responses,
    scale,
    scoringStrategy: args.scoringStrategy,
    totalQuestions: args.attempt.totalQuestions,
  });
}

/** Scores one IRT section from the same immutable scale as its parent attempt. */
export async function scoreIrtSection(
  ctx: MutationCtx,
  args: {
    attempt: TryoutAttempt;
    responses: TryoutResponse[];
    scoringStrategy: TryoutScoringStrategy;
    totalQuestions: number;
    tryoutSectionId: Id<"tryoutSections">;
  }
): Promise<AttemptScore> {
  const scale = await loadAttemptScale(ctx, args.attempt);
  const placements = await loadSectionPlacements(ctx, args);
  const items = await loadSectionScaleItems(ctx, { placements, scale });

  return buildIrtScore({
    items,
    placements,
    responses: args.responses,
    scale,
    scoringStrategy: args.scoringStrategy,
    totalQuestions: args.totalQuestions,
  });
}
