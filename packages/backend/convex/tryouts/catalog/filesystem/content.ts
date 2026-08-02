import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  loadQuestionContentRows,
  loadReadySections,
  toPublicTryoutExam,
  toPublicTryoutSection,
  toPublicTryoutSet,
  toPublicTryoutTrack,
} from "@repo/backend/convex/tryouts/queries/catalogModel";
import { loadActiveTryoutSetParents } from "@repo/backend/convex/tryouts/queries/parents";
import { Effect } from "effect";

interface CatalogPath {
  readonly locale: ContentLocale;
  readonly publicPath: string;
}

/** Reads one filesystem-owned set with its ready sections. */
export const readFilesystemSet = Effect.fn("tryouts.catalog.readFilesystemSet")(
  function* (ctx: QueryCtx, path: CatalogPath) {
    const set = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutSets")
        .withIndex("by_locale_and_publicPath", (query) =>
          query.eq("locale", path.locale).eq("publicPath", path.publicPath)
        )
        .unique()
    );
    if (!(set?.isActive && set.isReady)) {
      return null;
    }
    const [parents, readySections] = yield* Effect.all(
      [
        Effect.promise(() => loadActiveTryoutSetParents(ctx, set)),
        Effect.promise(() => loadReadySections(ctx, set)),
      ],
      { concurrency: "unbounded" }
    );
    if (!(parents && readySections)) {
      return null;
    }
    const visibleSections = readySections.filter(
      (section) => section.visibility === "visible" && section.publicPath
    );
    const entrySection =
      readySections.find(
        (section) => section.sectionKey === set.internalEntrySectionKey
      ) ??
      visibleSections[0] ??
      null;
    const entryQuestions =
      entrySection?.visibility === "internal-entry"
        ? yield* Effect.promise(() =>
            loadQuestionContentRows(ctx, entrySection)
          )
        : [];
    return {
      exam: toPublicTryoutExam(parents.exam),
      entryQuestions,
      entrySection: entrySection ? toPublicTryoutSection(entrySection) : null,
      set: toPublicTryoutSet(set),
      sections: visibleSections.map(toPublicTryoutSection),
      track: toPublicTryoutTrack(parents.track),
    };
  }
);

/** Reads one filesystem-owned visible section and its question content. */
export const readFilesystemSection = Effect.fn(
  "tryouts.catalog.readFilesystemSection"
)(function* (ctx: QueryCtx, path: CatalogPath) {
  const section = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutSections")
      .withIndex("by_locale_and_publicPath", (query) =>
        query.eq("locale", path.locale).eq("publicPath", path.publicPath)
      )
      .unique()
  );
  if (!(section?.visibility === "visible" && section.publicPath)) {
    return null;
  }
  const set = yield* Effect.promise(() => ctx.db.get(section.tryoutSetId));
  if (!(set?.isActive && set.isReady)) {
    return null;
  }
  const [parents, readySections] = yield* Effect.all(
    [
      Effect.promise(() => loadActiveTryoutSetParents(ctx, set)),
      Effect.promise(() => loadReadySections(ctx, set)),
    ],
    { concurrency: "unbounded" }
  );
  if (!parents) {
    return null;
  }
  const readySection = readySections?.find((item) => item._id === section._id);
  if (!readySection) {
    return null;
  }
  const questions = yield* Effect.promise(() =>
    loadQuestionContentRows(ctx, readySection)
  );
  return {
    exam: toPublicTryoutExam(parents.exam),
    questions,
    section: toPublicTryoutSection(section),
    set: toPublicTryoutSet(set),
    track: toPublicTryoutTrack(parents.track),
  };
});
