import { query } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/route";
import { tryoutAttemptSectionRouteValidator } from "@repo/backend/convex/tryouts/runtime/attempt/sections";
import { tryoutRuntimeChoiceValidator } from "@repo/backend/convex/tryouts/runtime/choice";
import { tryoutCurrentSectionValidator } from "@repo/backend/convex/tryouts/runtime/content";
import { readSectionState } from "@repo/backend/convex/tryouts/runtime/section/state";
import { readSetState } from "@repo/backend/convex/tryouts/runtime/set/state";
import { tryoutScoreResultValidator } from "@repo/backend/convex/tryouts/score";
import { tryoutStatusValidator } from "@repo/backend/convex/tryouts/status";
import { v } from "convex/values";

const currentAttemptValidator = v.object({
  activeSectionKey: v.union(tryoutRouteKeyValidator, v.null()),
  attemptId: v.id("tryoutAttempts"),
  attemptNumber: v.number(),
  completedSectionKeys: v.array(tryoutRouteKeyValidator),
  expiresAt: v.number(),
  lastActivityAt: v.number(),
  resumeSectionPublicPath: v.union(v.string(), v.null()),
  resumeSectionKey: v.union(tryoutRouteKeyValidator, v.null()),
  score: v.union(tryoutScoreResultValidator, v.null()),
  section: v.union(tryoutCurrentSectionValidator, v.null()),
  sectionRoutes: v.array(tryoutAttemptSectionRouteValidator),
  startedAt: v.number(),
  status: tryoutStatusValidator,
  totalQuestions: v.number(),
});

const runtimeResponseValidator = v.object({
  answeredAt: v.number(),
  selectedOptionId: v.optional(v.string()),
  updatedAt: v.number(),
});

const runtimeQuestionValidator = v.object({
  choices: v.array(tryoutRuntimeChoiceValidator),
  contentHash: v.string(),
  placementId: v.id("tryoutAttemptPlacements"),
  questionOrder: v.number(),
  response: v.union(runtimeResponseValidator, v.null()),
  sourcePath: v.string(),
  sourceRevision: v.string(),
  title: v.string(),
});

const sectionRuntimeValidator = v.object({
  attemptId: v.id("tryoutAttempts"),
  expiresAt: v.number(),
  questions: v.array(runtimeQuestionValidator),
  section: tryoutCurrentSectionValidator,
});

const sectionAttemptStateValidator = v.object({
  attemptId: v.id("tryoutAttempts"),
  expiresAt: v.number(),
  resumeSectionPublicPath: v.union(v.string(), v.null()),
  resumeSectionKey: v.union(tryoutRouteKeyValidator, v.null()),
  section: v.union(tryoutCurrentSectionValidator, v.null()),
  status: tryoutStatusValidator,
});

/** Loads one reactive set attempt and optional direct-entry runtime. */
export const getSetState = query({
  args: {
    attemptId: v.optional(v.string()),
    locale: localeValidator,
    publicPath: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      attempt: currentAttemptValidator,
      runtime: v.union(v.null(), sectionRuntimeValidator),
    })
  ),
  handler: (ctx, args) => runConvexProgram(readSetState(ctx, args)),
});

/** Loads the reactive attempt and section runtime through one authenticated read. */
export const getSectionState = query({
  args: {
    attemptId: v.optional(v.string()),
    locale: localeValidator,
    publicPath: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      attempt: sectionAttemptStateValidator,
      runtime: v.union(v.null(), sectionRuntimeValidator),
    })
  ),
  handler: (ctx, args) => runConvexProgram(readSectionState(ctx, args)),
});
