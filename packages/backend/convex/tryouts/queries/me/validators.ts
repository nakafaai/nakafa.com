import { exerciseAttemptStatusValidator } from "@repo/backend/convex/exercises/schema";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { tryoutProductValidator } from "@repo/backend/convex/tryouts/products";
import {
  tryoutPartKeyValidator,
  tryoutPublicResultStatusValidator,
} from "@repo/backend/convex/tryouts/schema";
import { v } from "convex/values";
import { nullable } from "convex-helpers/validators";

export const userTryoutLookupArgs = {
  product: tryoutProductValidator,
  locale: localeValidator,
  tryoutSlug: v.string(),
};

export const tryoutPackageLookupValidator = v.object({
  slug: v.string(),
  tryoutId: vv.id("tryouts"),
});

export const tryoutPackageStatusValidator = v.object({
  expiresAtMs: v.number(),
  slug: v.string(),
  status: vv.doc("tryoutAttempts").fields.status,
});

export const orderedTryoutPartValidator = v.object({
  partIndex: v.number(),
  partKey: tryoutPartKeyValidator,
});

export const tryoutPartAttemptSummarySetAttemptValidator = v.object({
  lastActivityAt: v.number(),
  startedAt: v.number(),
  status: exerciseAttemptStatusValidator,
  timeLimit: v.number(),
});

export const tryoutPartAttemptScoreSummaryValidator = v.object({
  correctAnswers: vv.doc("exerciseAttempts").fields.correctAnswers,
  theta: vv.doc("tryoutPartAttempts").fields.theta,
  thetaSE: vv.doc("tryoutPartAttempts").fields.thetaSE,
  irtScore: v.number(),
});

export const publicTryoutAttemptValidator = v.object({
  ...vv.doc("tryoutAttempts").fields,
  irtScore: v.number(),
  publicResultStatus: tryoutPublicResultStatusValidator,
});

export const publicTryoutAttemptHistoryValidator = v.object({
  attemptId: vv.id("tryoutAttempts"),
  attemptNumber: v.number(),
  completedAt: vv.doc("tryoutAttempts").fields.completedAt,
  countsForCompetition: v.boolean(),
  irtScore: v.number(),
  publicResultStatus: tryoutPublicResultStatusValidator,
  scoreStatus: vv.doc("tryoutAttempts").fields.scoreStatus,
  startedAt: vv.doc("tryoutAttempts").fields.startedAt,
  status: vv.doc("tryoutAttempts").fields.status,
  totalCorrect: vv.doc("tryoutAttempts").fields.totalCorrect,
  totalQuestions: vv.doc("tryoutAttempts").fields.totalQuestions,
});

export const tryoutPartAttemptSummaryValidator = v.object({
  partIndex: v.number(),
  partKey: tryoutPartKeyValidator,
  score: nullable(tryoutPartAttemptScoreSummaryValidator),
  setAttempt: nullable(tryoutPartAttemptSummarySetAttemptValidator),
});

export const userTryoutAttemptResultValidator = v.object({
  attempt: publicTryoutAttemptValidator,
  orderedParts: v.array(orderedTryoutPartValidator),
  partAttempts: v.array(tryoutPartAttemptSummaryValidator),
  resumePartKey: v.optional(tryoutPartKeyValidator),
  expiresAtMs: v.number(),
});

export const userTryoutAttemptHistoryResultValidator = v.array(
  publicTryoutAttemptHistoryValidator
);

export const tryoutPartAttemptRuntimeValidator = v.object({
  partIndex: v.number(),
  partKey: tryoutPartKeyValidator,
  setAttempt: vv.doc("exerciseAttempts"),
  answers: v.array(vv.doc("exerciseAnswers")),
});

export const userTryoutPartAttemptResultValidator = v.object({
  expiresAtMs: v.number(),
  partScore: nullable(tryoutPartAttemptScoreSummaryValidator),
  partAttempt: nullable(tryoutPartAttemptRuntimeValidator),
  tryoutAttempt: publicTryoutAttemptValidator,
});
