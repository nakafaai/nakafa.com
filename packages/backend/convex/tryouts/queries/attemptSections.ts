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
  return yield* loadSignedSectionRoutes(ctx, attempt);
});

/** Reads immutable visible rows from one retained signed catalog snapshot. */
const loadSignedSectionRoutes = Effect.fn(
  "tryouts.attempt.loadSignedSectionRoutes"
)(function* (ctx: QueryCtx, attempt: TryoutAttempt) {
  const catalog = yield* loadTryoutSnapshotCatalog(
    ctx,
    attempt.locale,
    attempt.tryoutSnapshotId
  );
  const routes: TryoutAttemptSectionRoute[] = [];
  for (const snapshot of attempt.sectionSnapshots) {
    const publicPath = snapshot.publicPath;
    if (!publicPath) {
      continue;
    }
    const section = yield* readPublishedSection(catalog, {
      countryKey: attempt.countryKey,
      examKey: attempt.examKey,
      locale: attempt.locale,
      sectionKey: snapshot.sectionKey,
      setKey: attempt.setKey,
      trackKey: attempt.trackKey,
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
