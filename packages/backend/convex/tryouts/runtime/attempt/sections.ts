import type { TryoutSection } from "@nakafa/aksara-contracts/tryout/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadVerifiedSnapshot } from "@repo/backend/convex/contentRelease/runtime/snapshot";
import { readTryoutSetSelection } from "@repo/backend/convex/tryouts/catalog/selection";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/route";
import { TryoutRuntimeError } from "@repo/backend/convex/tryouts/runtime/error";
import { type Infer, v } from "convex/values";
import { Effect, Schema } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutSectionSnapshot = TryoutAttempt["sectionSnapshots"][number];
type TryoutReadContext = Pick<QueryCtx, "db">;

export const tryoutAttemptSectionRouteValidator = v.object({
  publicPath: v.string(),
  questionCount: v.number(),
  sectionKey: tryoutRouteKeyValidator,
  title: v.string(),
});

type TryoutAttemptSectionRoute = Infer<
  typeof tryoutAttemptSectionRouteValidator
>;

/** Stable failure while projecting one attempt's immutable section routes. */
class TryoutAttemptSectionReadError extends Schema.TaggedError<TryoutAttemptSectionReadError>()(
  "TryoutAttemptSectionReadError",
  {
    code: Schema.Literal("TRYOUT_SECTION_SNAPSHOT_MISMATCH"),
    message: Schema.String,
  }
) {}

/** Loads every started section within the attempt's signed snapshot bound. */
export const loadAttemptSections = Effect.fn(
  "tryouts.runtime.loadAttemptSections"
)(function* (ctx: TryoutReadContext, attempt: TryoutAttempt) {
  const sections = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutSectionAttempts")
      .withIndex("by_tryoutAttemptId_and_sectionOrder", (query) =>
        query.eq("tryoutAttemptId", attempt._id)
      )
      .take(attempt.sectionSnapshots.length + 1)
  );

  if (sections.length > attempt.sectionSnapshots.length) {
    return yield* new TryoutRuntimeError({
      code: "TRYOUT_SECTION_ATTEMPT_COUNT_EXCEEDED",
      message: "Try-out section attempt count exceeds the attempt snapshot.",
    });
  }

  return sections;
});

/** Derives the active or next resumable section from immutable attempt state. */
export function readAttemptResume(
  attempt: TryoutAttempt,
  sections: readonly Doc<"tryoutSectionAttempts">[]
) {
  const inProgressSection = sections.find(
    (section) => section.status === "in-progress"
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
    resumeSectionKey: resumeSection?.sectionKey ?? null,
    resumeSectionPublicPath: resumeSection?.publicPath ?? null,
  };
}

/** Projects visible rows from a supplied or lazily loaded signed catalog. */
export const loadAttemptSectionRoutes = Effect.fn(
  "tryouts.attempt.loadSectionRoutes"
)(function* (
  ctx: QueryCtx,
  attempt: TryoutAttempt,
  suppliedSections?: readonly TryoutSection[]
) {
  const hasPublicRoutes = attempt.sectionSnapshots.some(
    (snapshot) => snapshot.publicPath !== undefined
  );
  if (!hasPublicRoutes) {
    return [];
  }

  const sections =
    suppliedSections ?? (yield* loadSignedSections(ctx, attempt));
  const routes: TryoutAttemptSectionRoute[] = [];
  for (const snapshot of attempt.sectionSnapshots) {
    const publicPath = snapshot.publicPath;
    if (!publicPath) {
      continue;
    }
    const section = sections.find(
      (candidate) =>
        candidate.sectionKey === snapshot.sectionKey &&
        candidate.visibility === "visible"
    );
    if (!(section && matchesSignedSnapshot(section, snapshot, publicPath))) {
      return yield* snapshotMismatch();
    }
    routes.push({
      publicPath,
      questionCount: snapshot.questionCount,
      sectionKey: snapshot.sectionKey,
      title: section.title,
    });
  }
  return routes;
});

/** Reads immutable section rows from one retained signed catalog snapshot. */
const loadSignedSections = Effect.fn("tryouts.attempt.loadSignedSections")(
  function* (ctx: QueryCtx, attempt: TryoutAttempt) {
    yield* loadVerifiedSnapshot(ctx, "tryout", attempt.tryoutSnapshotId);
    const catalog = yield* readTryoutSetSelection(ctx, {
      locale: attempt.locale,
      publicPath: attempt.setPublicPath,
      snapshotId: attempt.tryoutSnapshotId,
    });
    if (!catalog) {
      return yield* snapshotMismatch();
    }
    return catalog.sections;
  }
);

/** Checks immutable signed display fields against the attempt snapshot. */
function matchesSignedSnapshot(
  section: TryoutSection,
  snapshot: TryoutSectionSnapshot,
  publicPath: string
) {
  return (
    section.publicPath === publicPath &&
    section.questionCount === snapshot.questionCount &&
    section.sourceRevision === snapshot.sourceRevision &&
    section.timeLimitSeconds === snapshot.timeLimitSeconds
  );
}

/** Creates one typed frozen-section integrity failure. */
function snapshotMismatch() {
  return new TryoutAttemptSectionReadError({
    code: "TRYOUT_SECTION_SNAPSHOT_MISMATCH",
    message: "Try-out section route differs from its frozen attempt snapshot.",
  });
}
