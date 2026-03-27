import { exerciseAttemptStatusValidator } from "@repo/backend/convex/exercises/schema";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { tryoutProductValidator } from "@repo/backend/convex/tryouts/products";
import { tryoutPartKeyValidator } from "@repo/backend/convex/tryouts/schema";
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
  theta: vv.doc("tryoutPartAttempts").fields.theta,
  thetaSE: vv.doc("tryoutPartAttempts").fields.thetaSE,
  irtScore: vv.doc("tryoutAttempts").fields.irtScore,
});

export const tryoutPartAttemptSummaryValidator = v.object({
  partIndex: v.number(),
  partKey: tryoutPartKeyValidator,
  score: nullable(tryoutPartAttemptScoreSummaryValidator),
  setAttempt: tryoutPartAttemptSummarySetAttemptValidator,
});

export const userTryoutAttemptResultValidator = v.object({
  attempt: vv.doc("tryoutAttempts"),
  orderedParts: v.array(orderedTryoutPartValidator),
  partAttempts: v.array(tryoutPartAttemptSummaryValidator),
  resumePartKey: v.optional(tryoutPartKeyValidator),
  expiresAtMs: v.number(),
});

export const tryoutPartAttemptRuntimeValidator = v.object({
  partIndex: v.number(),
  partKey: tryoutPartKeyValidator,
  setAttempt: vv.doc("exerciseAttempts"),
  answers: v.array(vv.doc("exerciseAnswers")),
});

export const userTryoutPartAttemptResultValidator = v.object({
  expiresAtMs: v.number(),
  partAttempt: nullable(tryoutPartAttemptRuntimeValidator),
  tryoutAttempt: vv.doc("tryoutAttempts"),
});
