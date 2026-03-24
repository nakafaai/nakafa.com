import { exerciseAttemptStatusValidator } from "@repo/backend/convex/exercises/schema";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { tryoutProductValidator } from "@repo/backend/convex/tryouts/products";
import { tryoutPartKeyValidator } from "@repo/backend/convex/tryouts/schema";
import { type Infer, v } from "convex/values";

export const TRYOUT_STATUS_BATCH_SIZE = 25;

export const userTryoutLookupArgs = {
  product: tryoutProductValidator,
  locale: localeValidator,
  tryoutSlug: v.string(),
};

export interface UserTryoutLookup {
  locale: Infer<typeof localeValidator>;
  product: Infer<typeof tryoutProductValidator>;
  tryoutSlug: string;
}

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

export const tryoutPartAttemptSummaryValidator = v.object({
  partIndex: v.number(),
  partKey: tryoutPartKeyValidator,
  setAttempt: tryoutPartAttemptSummarySetAttemptValidator,
});

export const tryoutPartAttemptRuntimeValidator = v.object({
  partIndex: v.number(),
  partKey: tryoutPartKeyValidator,
  setAttempt: vv.doc("exerciseAttempts"),
  answers: v.array(vv.doc("exerciseAnswers")),
});
