import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import {
  type AppLocale,
  type AppLocaleCode,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { canonicalQuestionResponse } from "@nakafa/aksara-contracts/question/response";
import {
  type TryoutSection,
  type TryoutSet,
  TryoutSetSchema,
} from "@nakafa/aksara-contracts/tryout/catalog";
import { tryoutCatalogNodeIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { TryoutPlacement } from "@nakafa/aksara-contracts/tryout/placement";
import { loadTryoutOwner } from "@repo/backend/content/tryout/owner";
import {
  readTryoutSection,
  readTryoutSectionRow,
} from "@repo/backend/content/tryout/section";
import { TryoutSource } from "@repo/backend/content/tryout/source";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { verifyTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/verify";
import { tryoutResponseSpecValidator } from "@repo/backend/convex/tryouts/response/model";
import {
  type TryoutQuestionSelector,
  tryoutQuestionSelectorValidator,
} from "@repo/backend/convex/tryouts/runtime/content";
import { v } from "convex/values";
import { Effect, Option, Schema } from "effect";

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
    const owner = yield* loadTryoutOwner();
    const { snapshotId } = owner;
    const appLocale = AppLocaleSchema.make(locale);
    const target = LANDING_FEATURED_TRYOUT;
    const setIdentity = yield* readLandingFeaturedParents(
      snapshotId,
      appLocale
    );
    const set = yield* Schema.decodeUnknownEffect(TryoutSetSchema)(
      yield* readFeaturedRow(snapshotId, setIdentity, "set")
    ).pipe(Effect.orDie);
    const section = yield* readLandingFeaturedSection(
      snapshotId,
      setIdentity,
      set
    );
    const resolved = yield* readTryoutSection({
      countryKey: section.countryKey,
      examKey: section.examKey,
      locale,
      sectionKey: section.sectionKey,
      setKey: section.setKey,
      trackKey: section.trackKey,
    });
    const placement = resolved.placements.find(
      ({ row }) => row.questionContentKey === target.questionContentKey
    )?.row;
    const bundleHash = owner.active.release.tryoutRuntimeBundleHash ?? null;
    if (!(placement && bundleHash)) {
      return yield* missingFeaturedTryout("question");
    }

    const question: TryoutQuestionSelector = {
      appLocale: locale,
      artifactHash: placement.questionArtifactHash,
      bundleHash,
      contentHash: placement.contentHash,
      contentKey: placement.questionContentKey,
      delivery: "authenticated",
      questionOrder: placement.questionOrder,
      sectionKey: placement.sectionKey,
      snapshotReleaseId: owner.active.releaseId,
      snapshotId,
      sourcePath: placement.questionSourcePath,
      sourceRevision: placement.sourceRevision,
    };

    return {
      question,
      response: canonicalQuestionResponse(placement.response),
    };
  }
);

/** Reads the pinned landing ancestry and returns its signed set identity. */
const readLandingFeaturedParents = Effect.fn(
  "tryouts.catalog.readLandingFeaturedParents"
)(function* (snapshotId: string, appLocale: AppLocale) {
  const target = LANDING_FEATURED_TRYOUT;
  yield* readFeaturedRow(
    snapshotId,
    tryoutCatalogNodeIdentity({
      appLocale,
      countryKey: target.countryKey,
      kind: "country",
    }),
    "country"
  );
  yield* readFeaturedRow(
    snapshotId,
    tryoutCatalogNodeIdentity({
      appLocale,
      countryKey: target.countryKey,
      examKey: target.examKey,
      kind: "exam",
    }),
    "exam"
  );
  yield* readFeaturedRow(
    snapshotId,
    tryoutCatalogNodeIdentity({
      appLocale,
      countryKey: target.countryKey,
      examKey: target.examKey,
      kind: "track",
      trackKey: target.trackKey,
    }),
    "track"
  );
  return tryoutCatalogNodeIdentity({
    appLocale,
    countryKey: target.countryKey,
    examKey: target.examKey,
    kind: "set",
    setKey: target.setKey,
    trackKey: target.trackKey,
  });
});

/** Reads one verified catalog row by its authored identity. */
const readFeaturedRow = Effect.fn("tryouts.catalog.readFeaturedRow")(function* (
  snapshotId: string,
  identity: string,
  kind: FeaturedMissingKind
) {
  const source = yield* TryoutSource;
  const stored = Option.getOrNull(yield* source.identity(snapshotId, identity));
  if (!stored) {
    return yield* missingFeaturedTryout(kind);
  }
  return yield* verifyTryoutCatalog(stored, snapshotId);
});

/** Resolves the pinned landing section from its signed set inventory. */
const readLandingFeaturedSection = Effect.fn(
  "tryouts.catalog.readLandingFeaturedSection"
)(function* (snapshotId: string, setIdentity: string, set: TryoutSet) {
  const target = LANDING_FEATURED_TRYOUT;
  const source = yield* TryoutSource;
  const storedSections = yield* source.sections(
    snapshotId,
    setIdentity,
    set.sectionCount + 1
  );
  const sections = yield* Effect.forEach(storedSections, (stored) =>
    readTryoutSectionRow(snapshotId, stored)
  );
  const section = sections.find(
    ({ row }) =>
      row.sectionKey === target.sectionKey && row.visibility === "visible"
  );
  const questionCount = sections.reduce(
    (total, { row }) => total + row.questionCount,
    0
  );
  const visibleCount = sections.filter(
    ({ row }) => row.visibility === "visible"
  ).length;
  if (
    sections.length !== set.sectionCount ||
    questionCount !== set.questionCount ||
    visibleCount !== set.visibleSectionCount ||
    !section
  ) {
    return yield* missingFeaturedTryout("section");
  }
  return section.row;
});

type FeaturedMissingKind =
  | "country"
  | "exam"
  | "question"
  | "section"
  | "set"
  | "track";

/** Creates one fail-closed integrity error for an incomplete featured path. */
function missingFeaturedTryout(kind: FeaturedMissingKind) {
  return releaseFail(
    "CONTENT_RELEASE_INTEGRITY",
    `The active try-out publication has no featured ${kind}.`
  );
}
