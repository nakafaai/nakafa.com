import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import {
  tryoutCatalogIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import {
  type TryoutCatalogRow,
  TryoutCatalogRowSchema,
  TryoutContentHashSchema,
  type TryoutPlacement,
  TryoutPlacementSchema,
  type TryoutScoring,
} from "@nakafa/aksara-contracts/tryout/spec";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { testTextHash } from "@repo/backend/test/content-release";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout-snapshot";
import { Schema } from "effect";

export const TRYOUT_START_NOW = Date.UTC(2026, 6, 8, 12, 0, 0);
export const TRYOUT_START_COUNTRY = "indonesia";
export const TRYOUT_START_EXAM = "tka";
export const TRYOUT_START_TRACK = "matematika";
export const TRYOUT_START_SET = "set-1";
export const TRYOUT_START_SECTION = "matematika";
export const TRYOUT_START_CONTENT_HASH = TryoutContentHashSchema.make(
  "4".repeat(64)
);

const sourcePath = `question-bank/tryout/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_SECTION}/${TRYOUT_START_SET}`;
const setPath = `try-out/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_TRACK}/${TRYOUT_START_SET}`;
const tryoutStartLocales: readonly ContentLocale[] = ["en", "id"];

/** Activates the signed source that exactly matches the legacy start fixture. */
export async function activateTryoutStartSource(
  ctx: MutationCtx,
  visibility: "internal-entry" | "visible",
  scoringStrategy: TryoutScoring = "raw"
) {
  const catalog = tryoutStartLocales.flatMap((locale) =>
    makeTryoutStartCatalog(locale, visibility, scoringStrategy)
  );
  const placements = tryoutStartLocales.map(makeTryoutStartPlacement);
  const snapshotId = await activateTryoutSnapshot(ctx, {
    catalog,
    placements,
  });
  const section = catalog.find(
    (row) => row.kind === "section" && row.locale === "id"
  );
  const placement = placements.find(({ locale }) => locale === "id");
  if (!(section && placement)) {
    throw new Error("Expected one Indonesian signed try-out source.");
  }

  const sectionIdentity = tryoutCatalogIdentity(section);
  const storedSection = await ctx.db
    .query("tryoutCatalog")
    .withIndex("by_snapshotId_and_identity", (index) =>
      index.eq("snapshotId", snapshotId).eq("identity", sectionIdentity)
    )
    .unique();
  const placementIdentity = tryoutPlacementIdentity(placement);
  const storedPlacement = await ctx.db
    .query("tryoutPlacements")
    .withIndex("by_snapshotId_and_identity", (index) =>
      index.eq("snapshotId", snapshotId).eq("identity", placementIdentity)
    )
    .unique();
  if (!(storedSection && storedPlacement)) {
    throw new Error("Expected the signed try-out source to be stored.");
  }

  return {
    placementIdentity,
    placementRowHash: storedPlacement.rowHash,
    sectionCatalogId: storedSection._id,
    sectionIdentity,
    sectionRowHash: storedSection.rowHash,
    setIdentity: tryoutCatalogIdentity({
      countryKey: TRYOUT_START_COUNTRY,
      examKey: TRYOUT_START_EXAM,
      kind: "set",
      locale: "id",
      setKey: TRYOUT_START_SET,
      trackKey: TRYOUT_START_TRACK,
    }),
    snapshotId,
  };
}

/** Builds the localized set and section rows for the start fixture. */
export function makeTryoutStartCatalog(
  locale: ContentLocale,
  visibility: "internal-entry" | "visible",
  scoringStrategy: TryoutScoring = "raw"
): readonly TryoutCatalogRow[] {
  const internalEntry = visibility === "internal-entry";
  return Schema.decodeUnknownSync(Schema.Array(TryoutCatalogRowSchema))([
    {
      countryKey: TRYOUT_START_COUNTRY,
      examKey: TRYOUT_START_EXAM,
      graph: makeGraph(locale, "set"),
      internalEntrySectionKey: internalEntry ? TRYOUT_START_SECTION : undefined,
      kind: "set",
      locale,
      order: 1,
      publicPath: setPath,
      questionCount: 1,
      scoringStrategy,
      sectionCount: 1,
      setKey: TRYOUT_START_SET,
      sourceRevision: "2026",
      title: "Set 1",
      trackKey: TRYOUT_START_TRACK,
      visibleSectionCount: internalEntry ? 0 : 1,
    },
    {
      countryKey: TRYOUT_START_COUNTRY,
      examKey: TRYOUT_START_EXAM,
      graph: makeGraph(locale, "section"),
      kind: "section",
      locale,
      order: 1,
      publicPath: internalEntry
        ? undefined
        : `${setPath}/${TRYOUT_START_SECTION}`,
      questionCount: 1,
      questionSourcePath: `packages/corpus/${sourcePath}`,
      sectionKey: TRYOUT_START_SECTION,
      setKey: TRYOUT_START_SET,
      sourceRevision: "2026",
      timeLimitSeconds: 1800,
      title: "Matematika",
      trackKey: TRYOUT_START_TRACK,
      visibility,
    },
  ]);
}

/** Builds one localized signed placement matching the legacy question. */
export function makeTryoutStartPlacement(
  locale: ContentLocale
): TryoutPlacement {
  const questionRoot = `${sourcePath}/question-1`;
  return Schema.decodeUnknownSync(TryoutPlacementSchema)({
    answerArtifactHash: testTextHash(`${locale}:tryout-start:answer`),
    answerContentKey: `${questionRoot}/answer`,
    choices: [
      {
        isCorrect: true,
        label: "A",
        optionKey: "option-1",
        order: 1,
      },
    ],
    contentHash: TRYOUT_START_CONTENT_HASH,
    countryKey: TRYOUT_START_COUNTRY,
    examKey: TRYOUT_START_EXAM,
    locale,
    questionArtifactHash: testTextHash(`${locale}:tryout-start:question`),
    questionContentKey: `${questionRoot}/question`,
    questionOrder: 1,
    questionSourcePath: `packages/corpus/${questionRoot}`,
    rendererDomain: "tka-math",
    scope: "server",
    sectionKey: TRYOUT_START_SECTION,
    setKey: TRYOUT_START_SET,
    sourceRevision: "2026",
    title: "Question",
    trackKey: TRYOUT_START_TRACK,
  });
}

/** Builds one stable graph identity for a technical signed row. */
function makeGraph(locale: ContentLocale, kind: "section" | "set") {
  return {
    alignmentId: `alignment:tryout:start:${kind}`,
    assetId: `asset:${locale}:tryout:start:${kind}`,
    conceptId: `concept:tryout:start:${kind}`,
    learningObjectId: `lo:tryout-start-${kind}`,
    lensId: "lens:tryout:start",
  };
}
