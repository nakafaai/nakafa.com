import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  TryoutScoreStatus,
  TryoutScoringStrategy,
} from "@repo/backend/convex/tryouts/schema";

/** Stores the complete score snapshot produced before finalizing an attempt. */
export interface AttemptScore {
  publishedScore: number;
  rawScore: number;
  scaleVersionId?: Id<"irtScaleVersions">;
  scoreStatus: TryoutScoreStatus;
  scoringStrategy: TryoutScoringStrategy;
  theta?: number;
  thetaSE?: number;
  totalCorrect: number;
  totalQuestions: number;
}
