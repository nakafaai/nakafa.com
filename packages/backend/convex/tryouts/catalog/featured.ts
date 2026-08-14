import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/catalog";
import { readTryoutSection } from "@repo/backend/convex/contentRelease/tryout/section";
import {
  indexPublishedCatalog,
  type PublishedCatalogIndex,
  readPublishedSetSections,
  sortCatalogRows,
} from "@repo/backend/convex/tryouts/catalog/hierarchy";
import { tryoutChoiceSnapshotValidator } from "@repo/backend/convex/tryouts/runtime/choice";
import {
  type TryoutCurrentQuestionSelector,
  tryoutCurrentQuestionSelectorValidator,
} from "@repo/backend/convex/tryouts/runtime/content";
import { v } from "convex/values";
import { Effect } from "effect";

/**
 * Public model for the signed landing demo, including its visible answer feedback.
 */
export const featuredTryoutValidator = v.object({
  choices: v.array(tryoutChoiceSnapshotValidator),
  question: tryoutCurrentQuestionSelectorValidator,
});

/** Selects the first authored question from the canonical try-out hierarchy. */
export const readFeaturedTryout = Effect.fn("tryouts.catalog.readFeatured")(
  function* (ctx: QueryCtx, locale: AppLocaleCode) {
    const catalog = yield* loadTryoutCatalog(ctx, locale);
    const index = yield* indexPublishedCatalog(catalog);
    const section = yield* readFirstVisibleSection(index);
    if (!section) {
      return yield* missingFeaturedTryout("section");
    }

    const source = yield* readTryoutSection(ctx, {
      countryKey: section.countryKey,
      examKey: section.examKey,
      locale,
      sectionKey: section.sectionKey,
      setKey: section.setKey,
      trackKey: section.trackKey,
    });
    const placement = source.placements[0]?.row;
    if (!(placement && catalog.activeReleaseId)) {
      return yield* missingFeaturedTryout("question");
    }

    const question = {
      appLocale: locale,
      artifactHash: placement.questionArtifactHash,
      contentHash: placement.contentHash,
      contentKey: placement.questionContentKey,
      delivery: "authenticated",
      questionOrder: placement.questionOrder,
      snapshotReleaseId: catalog.activeReleaseId,
      snapshotId: catalog.snapshotId,
      sourcePath: placement.questionSourcePath,
      sourceRevision: placement.sourceRevision,
    } satisfies TryoutCurrentQuestionSelector;

    return {
      choices: [...placement.choices],
      question,
    };
  }
);

/** Finds the first public section in authored hierarchy order. */
const readFirstVisibleSection = Effect.fn(
  "tryouts.catalog.readFirstVisibleSection"
)(function* (index: PublishedCatalogIndex) {
  const countries = sortCatalogRows(index.countries);
  if (countries.length === 0) {
    return yield* missingFeaturedTryout("country");
  }

  for (const country of countries) {
    const exams = sortCatalogRows(
      index.exams.filter((row) => row.countryKey === country.countryKey)
    );
    if (exams.length === 0) {
      return yield* missingFeaturedTryout("exam");
    }

    for (const exam of exams) {
      const tracks = sortCatalogRows(
        index.tracks.filter(
          (row) =>
            row.countryKey === country.countryKey &&
            row.examKey === exam.examKey
        )
      );
      if (tracks.length === 0) {
        return yield* missingFeaturedTryout("track");
      }

      for (const track of tracks) {
        const sets = sortCatalogRows(
          index.sets.filter(
            (row) =>
              row.countryKey === country.countryKey &&
              row.examKey === exam.examKey &&
              row.trackKey === track.trackKey
          )
        );
        if (sets.length !== track.setCount) {
          return yield* missingFeaturedTryout("set");
        }

        for (const set of sets) {
          const sections = yield* readPublishedSetSections(index, set);
          const section = sections.find(
            ({ visibility }) => visibility === "visible"
          );
          if (section) {
            return section;
          }
        }
      }
    }
  }

  return null;
});

/** Creates one fail-closed integrity error for an incomplete featured path. */
function missingFeaturedTryout(
  kind: "country" | "exam" | "question" | "section" | "set" | "track"
) {
  return releaseFail(
    "CONTENT_RELEASE_INTEGRITY",
    `The active try-out publication has no featured ${kind}.`
  );
}
