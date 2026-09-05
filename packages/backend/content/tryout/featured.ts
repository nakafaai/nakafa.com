import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { canonicalQuestionResponse } from "@nakafa/aksara-contracts/question/response";
import type { TryoutSection } from "@nakafa/aksara-contracts/tryout/catalog";
import type { TryoutPlacement } from "@nakafa/aksara-contracts/tryout/placement";
import { loadTryoutCatalog } from "@repo/backend/content/tryout/catalog";
import {
  indexPublishedCatalog,
  type PublishedCatalogIndex,
  readPublishedSetSections,
} from "@repo/backend/content/tryout/hierarchy";
import { readTryoutSection } from "@repo/backend/content/tryout/section";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { tryoutResponseSpecValidator } from "@repo/backend/convex/tryouts/response/model";
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
  question: tryoutQuestionSelectorValidator,
  response: tryoutResponseSpecValidator,
});

type FeaturedTryoutTarget = Pick<
  TryoutSection,
  "countryKey" | "examKey" | "sectionKey" | "setKey" | "trackKey"
> &
  Pick<TryoutPlacement, "questionContentKey">;

/** Stable authored question demonstrated by the landing page learning loop. */
export const LANDING_FEATURED_TRYOUT = {
  countryKey: "indonesia",
  examKey: "snbt",
  questionContentKey: ContentKeySchema.make(
    "question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1/question-1/question"
  ),
  sectionKey: "quantitative-knowledge",
  setKey: "set-1",
  trackKey: "2027",
} as const satisfies FeaturedTryoutTarget;

/** Selects the stable authored question for the public landing demo. */
export const readFeaturedTryout = Effect.fn("tryouts.catalog.readFeatured")(
  function* (locale: AppLocaleCode) {
    const catalog = yield* loadTryoutCatalog(locale);
    const index = yield* indexPublishedCatalog(catalog);
    const section = yield* readLandingFeaturedSection(index, locale);
    const source = yield* readTryoutSection({
      countryKey: section.countryKey,
      examKey: section.examKey,
      locale,
      sectionKey: section.sectionKey,
      setKey: section.setKey,
      trackKey: section.trackKey,
    });
    const placement = source.placements.find(
      ({ row }) =>
        row.questionContentKey === LANDING_FEATURED_TRYOUT.questionContentKey
    )?.row;
    if (!(placement && catalog.activeReleaseId && catalog.bundleHash)) {
      return yield* missingFeaturedTryout("question");
    }

    const question: TryoutQuestionSelector = {
      appLocale: locale,
      artifactHash: placement.questionArtifactHash,
      bundleHash: catalog.bundleHash,
      contentHash: placement.contentHash,
      contentKey: placement.questionContentKey,
      delivery: "authenticated",
      questionOrder: placement.questionOrder,
      sectionKey: placement.sectionKey,
      snapshotReleaseId: catalog.activeReleaseId,
      snapshotId: catalog.snapshotId,
      sourcePath: placement.questionSourcePath,
      sourceRevision: placement.sourceRevision,
    };

    return {
      question,
      response: canonicalQuestionResponse(placement.response),
    };
  }
);

/** Resolves the stable landing section without depending on catalog order. */
const readLandingFeaturedSection = Effect.fn(
  "tryouts.catalog.readLandingFeaturedSection"
)(function* (index: PublishedCatalogIndex, locale: AppLocaleCode) {
  const target = LANDING_FEATURED_TRYOUT;
  const country = index.countries.find(
    (row) => row.appLocale === locale && row.countryKey === target.countryKey
  );
  if (!country) {
    return yield* missingFeaturedTryout("country");
  }

  const exam = index.exams.find(
    (row) =>
      row.appLocale === locale &&
      row.countryKey === country.countryKey &&
      row.examKey === target.examKey
  );
  if (!exam) {
    return yield* missingFeaturedTryout("exam");
  }

  const track = index.tracks.find(
    (row) =>
      row.appLocale === locale &&
      row.countryKey === exam.countryKey &&
      row.examKey === exam.examKey &&
      row.trackKey === target.trackKey
  );
  if (!track) {
    return yield* missingFeaturedTryout("track");
  }

  const sets = index.sets.filter(
    (row) =>
      row.appLocale === locale &&
      row.countryKey === track.countryKey &&
      row.examKey === track.examKey &&
      row.trackKey === track.trackKey
  );
  if (sets.length !== track.setCount) {
    return yield* missingFeaturedTryout("set");
  }

  const set = sets.find((row) => row.setKey === target.setKey);
  if (!set) {
    return yield* missingFeaturedTryout("set");
  }

  const sections = yield* readPublishedSetSections(index, set);
  const section = sections.find(
    (row) =>
      row.appLocale === locale &&
      row.sectionKey === target.sectionKey &&
      row.visibility === "visible"
  );
  if (!section) {
    return yield* missingFeaturedTryout("section");
  }
  return section;
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
