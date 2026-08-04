import type { TryoutSection } from "@nakafa/aksara-contracts/tryout/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadTryoutSnapshotCatalog } from "@repo/backend/convex/contentRelease/tryout/catalog";
import { readPublishedSection } from "@repo/backend/convex/tryouts/catalog/hierarchy";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/route";
import { type Infer, v } from "convex/values";
import { Effect, Schema } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutSectionSnapshot = TryoutAttempt["sectionSnapshots"][number];

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

/** Projects visible section rows from the exact source frozen by one attempt. */
export const loadAttemptSectionRoutes = Effect.fn(
  "tryouts.attempt.loadSectionRoutes"
)(function* (ctx: QueryCtx, attempt: TryoutAttempt) {
  if (attempt.tryoutSnapshotId) {
    return yield* loadSignedSectionRoutes(ctx, attempt);
  }
  return yield* loadFilesystemSectionRoutes(ctx, attempt);
});

/** Reads immutable visible rows from one retained signed catalog snapshot. */
const loadSignedSectionRoutes = Effect.fn(
  "tryouts.attempt.loadSignedSectionRoutes"
)(function* (ctx: QueryCtx, attempt: TryoutAttempt) {
  const countryKey = attempt.countryKey;
  const examKey = attempt.examKey;
  const locale = attempt.locale;
  const setKey = attempt.setKey;
  const snapshotId = attempt.tryoutSnapshotId;
  const trackKey = attempt.trackKey;
  if (!(countryKey && examKey && locale && setKey && snapshotId && trackKey)) {
    return yield* snapshotMismatch();
  }

  const catalog = yield* loadTryoutSnapshotCatalog(ctx, locale, snapshotId);
  const routes: TryoutAttemptSectionRoute[] = [];
  for (const snapshot of attempt.sectionSnapshots) {
    const publicPath = snapshot.publicPath;
    if (!publicPath) {
      continue;
    }
    const section = yield* readPublishedSection(catalog, {
      countryKey,
      examKey,
      locale,
      sectionKey: snapshot.sectionKey,
      setKey,
      trackKey,
    });
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

/** Reads visible rows while the exact filesystem source still exists. */
const loadFilesystemSectionRoutes = Effect.fn(
  "tryouts.attempt.loadFilesystemSectionRoutes"
)(function* (ctx: QueryCtx, attempt: TryoutAttempt) {
  const tryoutSetId = attempt.tryoutSetId;
  if (!tryoutSetId) {
    return [];
  }
  const set = yield* Effect.promise(() => ctx.db.get(tryoutSetId));
  if (!set) {
    return yield* snapshotMismatch();
  }

  const routes: TryoutAttemptSectionRoute[] = [];
  for (const snapshot of attempt.sectionSnapshots) {
    const publicPath = snapshot.publicPath;
    if (!publicPath) {
      continue;
    }
    const sectionId = snapshot.tryoutSectionId;
    if (!sectionId) {
      return yield* snapshotMismatch();
    }
    const section = yield* Effect.promise(() => ctx.db.get(sectionId));
    if (
      !(
        section && matchesFilesystemSnapshot(section, set, snapshot, publicPath)
      )
    ) {
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

/** Checks one filesystem section against its exact frozen route source. */
function matchesFilesystemSnapshot(
  section: Doc<"tryoutSections">,
  set: Doc<"tryoutSets">,
  snapshot: TryoutSectionSnapshot,
  publicPath: string
) {
  return (
    section.countryKey === set.countryKey &&
    section.examKey === set.examKey &&
    section.locale === set.locale &&
    section.order === snapshot.sectionOrder &&
    section.publicPath === publicPath &&
    section.questionCount === snapshot.questionCount &&
    section.questionSetId === snapshot.questionSetId &&
    section.questionSourcePath === snapshot.questionSourcePath &&
    section.sectionKey === snapshot.sectionKey &&
    section.setKey === set.setKey &&
    section.sourceRevision === snapshot.sourceRevision &&
    section.timeLimitSeconds === snapshot.timeLimitSeconds &&
    section.trackKey === set.trackKey &&
    section.tryoutSetId === set._id
  );
}

/** Creates one typed frozen-section integrity failure. */
function snapshotMismatch() {
  return new TryoutAttemptSectionReadError({
    code: "TRYOUT_SECTION_SNAPSHOT_MISMATCH",
    message: "Try-out section route differs from its frozen attempt snapshot.",
  });
}
