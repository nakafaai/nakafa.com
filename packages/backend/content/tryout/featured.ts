import {
  type AppLocale,
  type AppLocaleCode,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import {
  type TryoutSection,
  type TryoutSet,
  TryoutSetSchema,
} from "@nakafa/aksara-contracts/tryout/catalog";
import { tryoutCatalogNodeIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { TryoutPlacement } from "@nakafa/aksara-contracts/tryout/placement";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  verifyTryoutCatalog,
  verifyTryoutPlacement,
} from "@repo/backend/confect/contentRelease/tryout/verify";
import { freeze } from "@repo/backend/confect/response/projection";
import type { TryoutQuestionSelector } from "@repo/backend/confect/tryouts/runtime/spec";
import { provesSetInventory } from "@repo/backend/content/tryout/inventory";
import { loadTryoutOwner } from "@repo/backend/content/tryout/owner";
import { readTryoutSectionRow } from "@repo/backend/content/tryout/section";
import { TryoutSource } from "@repo/backend/content/tryout/source";
import { Array as Arr, Effect, Option, Schema } from "effect";

/**
 * Public model for the signed landing demo, including its visible answer feedback.
 */

type FeaturedTryoutTarget = Pick<
  TryoutSection,
  "countryKey" | "examKey" | "sectionKey" | "setKey" | "trackKey"
> &
  Pick<TryoutPlacement, "questionOrder">;

/**
 * Stable authored question demonstrated by the landing page learning loop:
 * question 1 of the quantitative knowledge section. The signed placement
 * contract derives the question's content key from its section, set and order,
 * so these keys name exactly one placement row and the read never loads the
 * other questions of the section.
 */
export const LANDING_FEATURED_TRYOUT = {
  countryKey: "indonesia",
  examKey: "snbt",
  questionOrder: 1,
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
    const stored = Option.getOrNull(
      yield* (yield* TryoutSource).placement(
        snapshotId,
        section,
        target.questionOrder
      )
    );
    const bundleHash = owner.active.release.tryoutRuntimeBundleHash ?? null;
    if (!(stored && bundleHash)) {
      return yield* missingFeaturedTryout("question");
    }
    const placement = yield* verifyTryoutPlacement(stored, snapshotId);
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
      response: freeze(placement.response, placement.deliveryLanguage),
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
  const sections = Arr.map(
    yield* Effect.forEach(storedSections, (stored) =>
      readTryoutSectionRow(snapshotId, stored)
    ),
    ({ row }) => row
  );
  const section = Arr.findFirst(
    sections,
    (row) =>
      row.sectionKey === target.sectionKey && row.visibility === "visible"
  );
  if (!(provesSetInventory(set, sections) && Option.isSome(section))) {
    return yield* missingFeaturedTryout("section");
  }
  return section.value;
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
