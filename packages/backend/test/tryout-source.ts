import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import {
  type ActiveAppLocaleCode,
  ActiveAppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import {
  type TryoutCatalogRow,
  TryoutCatalogRowSchema,
} from "@nakafa/aksara-contracts/tryout/catalog";
import {
  tryoutCatalogIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import {
  deliveryLanguageForSection,
  questionArtifactLocaleForSection,
} from "@nakafa/aksara-contracts/tryout/language";
import {
  type TryoutPlacement,
  TryoutPlacementSchema,
} from "@nakafa/aksara-contracts/tryout/placement";
import {
  TryoutContentHashSchema,
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
export const TRYOUT_REVISED_SECTION = "numerasi";
export const TRYOUT_REUSED_SET = "set-2";
export const TRYOUT_REUSED_SECTION = "aljabar";
export const TRYOUT_RENAMED_SET_PATH = PublicPathSchema.make(
  `try-out/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_TRACK}/renamed-set`
);
const renamedSectionPath = PublicPathSchema.make(
  `${TRYOUT_RENAMED_SET_PATH}/${TRYOUT_START_SECTION}`
);
export const TRYOUT_START_CONTENT_HASH = TryoutContentHashSchema.make(
  "4".repeat(64)
);

const sourcePath = `question-bank/tryout/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_SECTION}/${TRYOUT_START_SET}`;
const setPath = `try-out/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_TRACK}/${TRYOUT_START_SET}`;
const tryoutStartLocales: readonly ActiveAppLocaleCode[] = ["en", "id"];

/** Activates the signed source that exactly matches the legacy start fixture. */
export async function activateTryoutStartSource(
  ctx: MutationCtx,
  visibility: "internal-entry" | "visible",
  scoringStrategy: TryoutScoring = "raw"
) {
  const catalog = tryoutStartLocales.flatMap((locale) =>
    makeTryoutStartHierarchy(locale, visibility, scoringStrategy)
  );
  const placements = tryoutStartLocales.map(makeTryoutStartPlacement);
  const snapshotId = await activateTryoutSnapshot(ctx, {
    catalog,
    placements,
  });
  const section = catalog.find(
    (row) => row.kind === "section" && row.appLocale === "id"
  );
  const set = catalog.find(
    (row) => row.kind === "set" && row.appLocale === "id"
  );
  const placement = placements.find(({ appLocale }) => appLocale === "id");
  if (!(section?.kind === "section" && set?.kind === "set" && placement)) {
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
    set,
    setIdentity: tryoutCatalogIdentity(set),
    snapshotId,
  };
}

/** Activates a renamed set route while retaining the original test snapshot. */
export async function activateRenamedTryoutStartSource(ctx: MutationCtx) {
  await clearActiveTryoutSnapshot(ctx);

  const catalog = tryoutStartLocales.flatMap((locale) =>
    makeTryoutStartHierarchy(locale, "visible").map((row) => {
      if (row.kind === "set") {
        return { ...row, publicPath: TRYOUT_RENAMED_SET_PATH };
      }
      if (row.kind === "section") {
        return { ...row, publicPath: renamedSectionPath };
      }
      return row;
    })
  );
  await activateTryoutSnapshot(ctx, {
    catalog,
    placements: tryoutStartLocales.map(makeTryoutStartPlacement),
  });
}

/** Activates a new internal entry for the same logical set identity. */
export async function activateRevisedTryoutStartEntry(ctx: MutationCtx) {
  await clearActiveTryoutSnapshot(ctx);

  const catalog = tryoutStartLocales.flatMap((locale) =>
    Schema.decodeUnknownSync(Schema.Array(TryoutCatalogRowSchema))(
      makeTryoutStartHierarchy(locale, "internal-entry").map((row) => {
        if (row.kind === "set") {
          return {
            ...row,
            internalEntrySectionKey: TRYOUT_REVISED_SECTION,
            publicPath: TRYOUT_RENAMED_SET_PATH,
            sourceRevision: "2027",
          };
        }
        if (row.kind === "section") {
          return {
            ...row,
            questionSourcePath: `packages/corpus/${revisedSourcePath}`,
            sectionKey: TRYOUT_REVISED_SECTION,
            sourceRevision: "2027",
            title: "Numerasi",
          };
        }
        return row;
      })
    )
  );
  await activateTryoutSnapshot(ctx, {
    catalog,
    placements: tryoutStartLocales.map(makeRevisedTryoutStartPlacement),
  });
}

/** Activates a different logical set at the original public path. */
export async function activateReusedTryoutStartPath(ctx: MutationCtx) {
  await clearActiveTryoutSnapshot(ctx);

  const catalog = tryoutStartLocales.flatMap((locale) =>
    Schema.decodeUnknownSync(Schema.Array(TryoutCatalogRowSchema))(
      makeTryoutStartHierarchy(locale, "visible").map((row) => {
        if (row.kind === "set") {
          return {
            ...row,
            graph: makeGraph(locale, "set", "reused"),
            setKey: TRYOUT_REUSED_SET,
            title: "Set 2",
          };
        }
        if (row.kind === "section") {
          return {
            ...row,
            graph: makeGraph(locale, "section", "reused"),
            questionSourcePath: `packages/corpus/${reusedSourcePath}`,
            sectionKey: TRYOUT_REUSED_SECTION,
            setKey: TRYOUT_REUSED_SET,
            title: "Aljabar",
          };
        }
        return row;
      })
    )
  );
  await activateTryoutSnapshot(ctx, {
    catalog,
    placements: tryoutStartLocales.map(makeReusedTryoutStartPlacement),
  });
}

/** Builds the complete localized hierarchy around the signed start fixture. */
export function makeTryoutStartHierarchy(
  appLocale: ActiveAppLocaleCode,
  visibility: "internal-entry" | "visible",
  scoringStrategy: TryoutScoring = "raw"
): readonly TryoutCatalogRow[] {
  const countryPath = `try-out/${TRYOUT_START_COUNTRY}`;
  const examPath = `${countryPath}/${TRYOUT_START_EXAM}`;
  const trackPath = `${examPath}/${TRYOUT_START_TRACK}`;
  const visibleSectionCount = visibility === "visible" ? 1 : 0;
  const parents = Schema.decodeUnknownSync(
    Schema.Array(TryoutCatalogRowSchema)
  )([
    {
      countryCode: "ID",
      countryKey: TRYOUT_START_COUNTRY,
      appLocale,
      graph: makeGraph(appLocale, "country"),
      kind: "country",
      order: 1,
      publicPath: countryPath,
      sourceRevision: "2026",
      title: "Indonesia",
    },
    {
      countryKey: TRYOUT_START_COUNTRY,
      examKey: TRYOUT_START_EXAM,
      appLocale,
      graph: makeGraph(appLocale, "exam"),
      kind: "exam",
      order: 1,
      publicPath: examPath,
      scoringStrategy,
      sourceRevision: "2026",
      title: "TKA",
    },
    {
      countryKey: TRYOUT_START_COUNTRY,
      examKey: TRYOUT_START_EXAM,
      appLocale,
      graph: makeGraph(appLocale, "track"),
      kind: "track",
      order: 1,
      publicPath: trackPath,
      questionCount: 1,
      sectionCount: 1,
      setCount: 1,
      sourceRevision: "2026",
      title: appLocale === "id" ? "Matematika" : "Mathematics",
      trackKey: TRYOUT_START_TRACK,
      trackKind: "subject",
      visibleSectionCount,
    },
  ]);
  return [
    ...parents,
    ...makeTryoutStartCatalog(appLocale, visibility, scoringStrategy),
  ];
}

/** Builds the localized set and section rows for the start fixture. */
export function makeTryoutStartCatalog(
  appLocale: ActiveAppLocaleCode,
  visibility: "internal-entry" | "visible",
  scoringStrategy: TryoutScoring = "raw"
): readonly TryoutCatalogRow[] {
  const internalEntry = visibility === "internal-entry";
  return Schema.decodeUnknownSync(Schema.Array(TryoutCatalogRowSchema))([
    {
      countryKey: TRYOUT_START_COUNTRY,
      examKey: TRYOUT_START_EXAM,
      appLocale,
      graph: makeGraph(appLocale, "set"),
      internalEntrySectionKey: internalEntry ? TRYOUT_START_SECTION : undefined,
      kind: "set",
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
      appLocale,
      graph: makeGraph(appLocale, "section"),
      kind: "section",
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
  appLocale: ActiveAppLocaleCode
): TryoutPlacement {
  const signedAppLocale = ActiveAppLocaleSchema.make(appLocale);
  const questionRoot = `${sourcePath}/question-1`;
  return Schema.decodeUnknownSync(TryoutPlacementSchema)({
    answerArtifactHash: testTextHash(`${appLocale}:tryout-start:answer`),
    answerArtifactLocale: signedAppLocale,
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
    deliveryLanguage: deliveryLanguageForSection(
      TRYOUT_START_SECTION,
      signedAppLocale
    ),
    examKey: TRYOUT_START_EXAM,
    appLocale: signedAppLocale,
    questionArtifactHash: testTextHash(`${appLocale}:tryout-start:question`),
    questionArtifactLocale: questionArtifactLocaleForSection(
      TRYOUT_START_SECTION,
      signedAppLocale
    ),
    questionContentKey: `${questionRoot}/question`,
    questionOrder: 1,
    questionSourcePath: `packages/corpus/${questionRoot}`,
    rendererDomain: "tka-math",
    scope: "server",
    sectionKey: TRYOUT_START_SECTION,
    setKey: TRYOUT_START_SET,
    sourceRevision: "2026",
    trackKey: TRYOUT_START_TRACK,
  });
}

/** Builds one stable graph identity for a technical signed row. */
function makeGraph(
  appLocale: ActiveAppLocaleCode,
  kind: "country" | "exam" | "section" | "set" | "track",
  owner = "start"
) {
  return {
    alignmentId: `alignment:tryout:${owner}:${kind}`,
    assetId: `asset:${appLocale}:tryout:${owner}:${kind}`,
    conceptId: `concept:tryout:${owner}:${kind}`,
    learningObjectId: `lo:tryout-${owner}-${kind}`,
    lensId: `lens:tryout:${owner}`,
  };
}

const reusedSourcePath = `question-bank/tryout/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_REUSED_SECTION}/${TRYOUT_REUSED_SET}`;
const revisedSourcePath = `question-bank/tryout/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_REVISED_SECTION}/${TRYOUT_START_SET}`;

/** Builds one replacement placement for the revised internal entry. */
function makeRevisedTryoutStartPlacement(appLocale: ActiveAppLocaleCode) {
  const questionRoot = `${revisedSourcePath}/question-1`;
  return Schema.decodeUnknownSync(TryoutPlacementSchema)({
    ...makeTryoutStartPlacement(appLocale),
    answerContentKey: `${questionRoot}/answer`,
    questionContentKey: `${questionRoot}/question`,
    questionSourcePath: `packages/corpus/${questionRoot}`,
    sectionKey: TRYOUT_REVISED_SECTION,
    sourceRevision: "2027",
  });
}

/** Builds one replacement placement whose public path belongs to another set. */
function makeReusedTryoutStartPlacement(appLocale: ActiveAppLocaleCode) {
  const questionRoot = `${reusedSourcePath}/question-1`;
  return Schema.decodeUnknownSync(TryoutPlacementSchema)({
    ...makeTryoutStartPlacement(appLocale),
    answerContentKey: `${questionRoot}/answer`,
    questionContentKey: `${questionRoot}/question`,
    questionSourcePath: `packages/corpus/${questionRoot}`,
    sectionKey: TRYOUT_REUSED_SECTION,
    setKey: TRYOUT_REUSED_SET,
  });
}

/** Clears only the active release pointer before activating another fixture. */
async function clearActiveTryoutSnapshot(ctx: MutationCtx) {
  const state = await ctx.db.query("contentState").unique();
  if (!state) {
    throw new Error("Expected active content state before source replacement.");
  }
  await ctx.db.delete(state._id);

  const releases = await ctx.db.query("contentReleases").collect();
  for (const release of releases) {
    await ctx.db.delete(release._id);
  }
}
