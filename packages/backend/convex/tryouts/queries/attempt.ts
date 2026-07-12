import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { type QueryCtx, query } from "@repo/backend/convex/_generated/server";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import {
  getSectionScoreResult,
  loadAttemptScoreResult,
} from "@repo/backend/convex/tryouts/queries/score";
import {
  getActiveTryoutSet,
  getActiveTryoutSetByPublicPath,
} from "@repo/backend/convex/tryouts/read";
import { tryoutCurrentSectionValidator } from "@repo/backend/convex/tryouts/runtime/content";
import {
  tryoutRouteKeyValidator,
  tryoutScoreResultValidator,
  tryoutStatusValidator,
} from "@repo/backend/convex/tryouts/schema";
import { ConvexError, v } from "convex/values";

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
  startedAt: v.number(),
  status: tryoutStatusValidator,
  totalQuestions: v.number(),
});

/** Loads bounded section attempt rows for resume-state derivation. */
async function loadSectionAttempts(
  ctx: QueryCtx,
  attempt: Doc<"tryoutAttempts">
) {
  const sections = await ctx.db
    .query("tryoutSectionAttempts")
    .withIndex("by_tryoutAttemptId_and_sectionOrder", (q) =>
      q.eq("tryoutAttemptId", attempt._id)
    )
    .take(attempt.sectionSnapshots.length + 1);

  if (sections.length > attempt.sectionSnapshots.length) {
    throw new ConvexError({
      code: "TRYOUT_SECTION_ATTEMPT_COUNT_EXCEEDED",
      message: "Try-out section attempt count exceeds the attempt snapshot.",
    });
  }

  return sections;
}

/** Reads the latest attempt snapshot for one resolved set row. */
async function loadCurrentAttempt(
  ctx: QueryCtx,
  args: {
    sectionKey?: string;
    set: Doc<"tryoutSets">;
    userId: Doc<"users">["_id"];
  }
) {
  const attempt = await ctx.db
    .query("tryoutAttempts")
    .withIndex("by_userId_and_tryoutSetId_and_startedAt", (q) =>
      q.eq("userId", args.userId).eq("tryoutSetId", args.set._id)
    )
    .order("desc")
    .first();

  if (!attempt) {
    return null;
  }

  let section: Doc<"tryoutSectionAttempts"> | null = null;

  if (args.sectionKey) {
    const sectionKey = args.sectionKey;

    section = await ctx.db
      .query("tryoutSectionAttempts")
      .withIndex("by_tryoutAttemptId_and_sectionKey", (q) =>
        q.eq("tryoutAttemptId", attempt._id).eq("sectionKey", sectionKey)
      )
      .unique();
  }

  const [sections, score] = await Promise.all([
    loadSectionAttempts(ctx, attempt),
    loadAttemptScoreResult(ctx, attempt),
  ]);
  const inProgressSection = sections.find(
    (sectionAttempt) => sectionAttempt.status === "in-progress"
  );
  const completedSections = new Set(attempt.completedSectionKeys);
  const nextSection = attempt.sectionSnapshots.find(
    (snapshot) => !completedSections.has(snapshot.sectionKey)
  );
  const resumeSection = inProgressSection
    ? attempt.sectionSnapshots.find(
        (snapshot) => snapshot.sectionKey === inProgressSection.sectionKey
      )
    : nextSection;

  return {
    activeSectionKey: inProgressSection?.sectionKey ?? null,
    attemptId: attempt._id,
    attemptNumber: attempt.attemptNumber,
    completedSectionKeys: attempt.completedSectionKeys,
    expiresAt: attempt.expiresAt,
    lastActivityAt: attempt.lastActivityAt,
    resumeSectionKey: resumeSection?.sectionKey ?? null,
    resumeSectionPublicPath: resumeSection?.publicPath ?? null,
    score,
    section: section
      ? {
          answeredCount: section.answeredCount,
          completedAt: section.completedAt,
          endReason: section.endReason,
          expiresAt: section.expiresAt,
          score: getSectionScoreResult(section),
          sectionKey: section.sectionKey,
          startedAt: section.startedAt,
          status: section.status,
          totalQuestions: section.totalQuestions,
        }
      : null,
    startedAt: attempt.startedAt,
    status: attempt.status,
    totalQuestions: attempt.totalQuestions,
  };
}

/** Reads the current user's latest try-out attempt for a public set identity. */
export const getCurrent = query({
  args: {
    countryKey: tryoutRouteKeyValidator,
    examKey: tryoutRouteKeyValidator,
    locale: localeValidator,
    sectionKey: v.optional(tryoutRouteKeyValidator),
    setKey: tryoutRouteKeyValidator,
    trackKey: tryoutRouteKeyValidator,
  },
  returns: v.union(v.null(), currentAttemptValidator),
  handler: async (ctx, args) => {
    const auth = await getOptionalAppUser(ctx);

    if (!auth) {
      return null;
    }

    const set = await getActiveTryoutSet(ctx, args);

    if (!set) {
      return null;
    }

    return await loadCurrentAttempt(ctx, {
      sectionKey: args.sectionKey,
      set,
      userId: auth.appUser._id,
    });
  },
});

/** Reads the current user's latest try-out attempt for a localized set route. */
export const getCurrentByPublicPath = query({
  args: {
    locale: localeValidator,
    publicPath: v.string(),
  },
  returns: v.union(v.null(), currentAttemptValidator),
  handler: async (ctx, args) => {
    const auth = await getOptionalAppUser(ctx);

    if (!auth) {
      return null;
    }

    const set = await getActiveTryoutSetByPublicPath(ctx, args);

    if (!set) {
      return null;
    }

    return await loadCurrentAttempt(ctx, {
      set,
      userId: auth.appUser._id,
    });
  },
});
