import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { type QueryCtx, query } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { getOptionalAppUserForRead } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import {
  loadAttemptSectionRoutes,
  tryoutAttemptSectionRouteValidator,
} from "@repo/backend/convex/tryouts/queries/attemptSections";
import {
  getSectionScoreResult,
  loadAttemptScoreResult,
} from "@repo/backend/convex/tryouts/queries/score";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/route";
import { tryoutCurrentSectionValidator } from "@repo/backend/convex/tryouts/runtime/content";
import {
  readLatestAttemptByPath,
  readRouteAttempt,
} from "@repo/backend/convex/tryouts/runtime/lookup";
import { tryoutScoreResultValidator } from "@repo/backend/convex/tryouts/score";
import { tryoutStatusValidator } from "@repo/backend/convex/tryouts/status";
import { v } from "convex/values";
import { Effect, Schema } from "effect";

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

/** Stable integrity failure while reading one immutable attempt snapshot. */
class TryoutAttemptReadError extends Schema.TaggedError<TryoutAttemptReadError>()(
  "TryoutAttemptReadError",
  {
    code: Schema.Literal("TRYOUT_SECTION_ATTEMPT_COUNT_EXCEEDED"),
    message: Schema.String,
  }
) {}

/** Loads bounded section attempt rows for resume-state derivation. */
const loadSectionAttempts = Effect.fn("tryouts.attempt.loadSections")(
  function* (ctx: QueryCtx, attempt: Doc<"tryoutAttempts">) {
    const sections = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutSectionAttempts")
        .withIndex("by_tryoutAttemptId_and_sectionOrder", (query) =>
          query.eq("tryoutAttemptId", attempt._id)
        )
        .take(attempt.sectionSnapshots.length + 1)
    );

    if (sections.length > attempt.sectionSnapshots.length) {
      return yield* new TryoutAttemptReadError({
        code: "TRYOUT_SECTION_ATTEMPT_COUNT_EXCEEDED",
        message: "Try-out section attempt count exceeds the attempt snapshot.",
      });
    }

    return sections;
  }
);

/** Reads the latest attempt snapshot for one resolved set row. */
const loadCurrentAttempt = Effect.fn("tryouts.attempt.loadCurrent")(function* (
  ctx: QueryCtx,
  args: {
    readonly attempt: Doc<"tryoutAttempts">;
    readonly sectionKey?: string;
  }
) {
  const attempt = args.attempt;
  let section: Doc<"tryoutSectionAttempts"> | null = null;

  if (args.sectionKey) {
    const sectionKey = args.sectionKey;

    section = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutSectionAttempts")
        .withIndex("by_tryoutAttemptId_and_sectionKey", (query) =>
          query.eq("tryoutAttemptId", attempt._id).eq("sectionKey", sectionKey)
        )
        .unique()
    );
  }

  const [sections, score, sectionRoutes] = yield* Effect.all(
    [
      loadSectionAttempts(ctx, attempt),
      Effect.promise(() => loadAttemptScoreResult(ctx, attempt)),
      loadAttemptSectionRoutes(ctx, attempt),
    ],
    { concurrency: "unbounded" }
  );
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
    sectionRoutes,
    startedAt: attempt.startedAt,
    status: attempt.status,
    totalQuestions: attempt.totalQuestions,
  };
});

/** Reads the current user's latest try-out attempt for a public set identity. */
export const getCurrent = query({
  args: {
    attemptId: v.optional(v.id("tryoutAttempts")),
    countryKey: tryoutRouteKeyValidator,
    examKey: tryoutRouteKeyValidator,
    locale: localeValidator,
    sectionKey: v.optional(tryoutRouteKeyValidator),
    setKey: tryoutRouteKeyValidator,
    trackKey: tryoutRouteKeyValidator,
  },
  returns: v.union(v.null(), currentAttemptValidator),
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        const auth = yield* Effect.promise(() =>
          getOptionalAppUserForRead(ctx)
        );
        if (!auth) {
          return null;
        }
        const attempt = yield* readRouteAttempt(ctx, args, auth.appUser._id);
        if (!attempt) {
          return null;
        }
        return yield* loadCurrentAttempt(ctx, {
          attempt,
          sectionKey: args.sectionKey,
        });
      })
    ),
});

/** Reads the current user's latest try-out attempt for a localized set route. */
export const getCurrentByPublicPath = query({
  args: {
    locale: localeValidator,
    publicPath: v.string(),
  },
  returns: v.union(v.null(), currentAttemptValidator),
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        const auth = yield* Effect.promise(() =>
          getOptionalAppUserForRead(ctx)
        );
        if (!auth) {
          return null;
        }
        const attempt = yield* readLatestAttemptByPath(
          ctx,
          args,
          auth.appUser._id
        );
        if (!attempt) {
          return null;
        }
        return yield* loadCurrentAttempt(ctx, { attempt });
      })
    ),
});
