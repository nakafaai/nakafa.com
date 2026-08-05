import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import type { TryoutSet } from "@nakafa/aksara-contracts/tryout/spec";
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
  type TryoutQuestionSelector,
  tryoutQuestionSelectorValidator,
} from "@repo/backend/convex/tryouts/runtime/content";
import { v } from "convex/values";
import { Effect } from "effect";

/**
 * Public model for the signed landing demo, including its visible answer feedback.
 */
export const featuredTryoutValidator = v.object({
  choices: v.array(tryoutChoiceSnapshotValidator),
  question: tryoutQuestionSelectorValidator,
});

/** Selects the first authored question from the canonical try-out hierarchy. */
export const readFeaturedTryout = Effect.fn("tryouts.catalog.readFeatured")(
  function* (ctx: QueryCtx, locale: ContentLocale) {
    const catalog = yield* loadTryoutCatalog(ctx, locale);
    const index = yield* indexPublishedCatalog(catalog);

    const country = sortCatalogRows(index.countries).at(0);
    if (!country) {
      return yield* missingFeaturedTryout("country");
    }

    const exam = sortCatalogRows(
      index.exams.filter((row) => row.countryKey === country.countryKey)
    ).at(0);
    if (!exam) {
      return yield* missingFeaturedTryout("exam");
    }

    const track = sortCatalogRows(
      index.tracks.filter(
        (row) =>
          row.countryKey === country.countryKey && row.examKey === exam.examKey
      )
    ).at(0);
    if (!track) {
      return yield* missingFeaturedTryout("track");
    }

    const sets = sortCatalogRows(
      index.sets.filter(
        (row) =>
          row.countryKey === country.countryKey &&
          row.examKey === exam.examKey &&
          row.trackKey === track.trackKey
      )
    );
    if (sets.length === 0) {
      return yield* missingFeaturedTryout("set");
    }

    const section = yield* readFirstVisibleSection(index, sets);
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
      artifactHash: placement.questionArtifactHash,
      contentHash: placement.contentHash,
      contentKey: placement.questionContentKey,
      delivery: "authenticated",
      locale,
      questionOrder: placement.questionOrder,
      snapshotReleaseId: catalog.activeReleaseId,
      snapshotId: catalog.snapshotId,
      sourcePath: placement.questionSourcePath,
      sourceRevision: placement.sourceRevision,
    } satisfies TryoutQuestionSelector;

    return {
      choices: [...placement.choices],
      question,
    };
  }
);

/** Finds the first public section while preserving authored set order. */
const readFirstVisibleSection = Effect.fn(
  "tryouts.catalog.readFirstVisibleSection"
)(function* (index: PublishedCatalogIndex, sets: readonly TryoutSet[]) {
  for (const set of sets) {
    const sections = yield* readPublishedSetSections(index, set);
    const section = sections.find(({ visibility }) => visibility === "visible");
    if (section) {
      return section;
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
