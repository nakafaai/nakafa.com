import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import {
  ACTIVE_APP_LOCALES,
  type ActiveAppLocaleCode,
  ActiveAppLocaleListSchema,
  APP_LOCALE_CODES,
} from "@nakafa/aksara-contracts/locale";
import type {
  ContentSnapshotManifest,
  ContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot/data";
import { canonicalizeContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import {
  inheritContentSnapshots,
  replaceContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import {
  type TryoutCatalogRow,
  TryoutCatalogRowSchema,
} from "@nakafa/aksara-contracts/tryout/catalog";
import {
  digestTryoutCatalog,
  makeTryoutCatalogRecord,
} from "@nakafa/aksara-contracts/tryout/hash/catalog";
import {
  digestTryoutPlacements,
  makeTryoutPlacementRecord,
} from "@nakafa/aksara-contracts/tryout/hash/placement";
import {
  tryoutCatalogIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import {
  type TryoutPlacement,
  TryoutPlacementSchema,
} from "@nakafa/aksara-contracts/tryout/placement";
import { makeTryoutSnapshot } from "@nakafa/aksara-contracts/tryout/snapshot/hash";
import { TryoutContentHashSchema } from "@nakafa/aksara-contracts/tryout/spec";
import {
  tryoutCatalogFacts,
  tryoutPlacementFacts,
} from "@repo/backend/confect/contentRelease/tryout/facts";
import { encodeSnapshotJson } from "@repo/backend/confect/contentRelease/wire";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content/release";
import { insertTestRelease } from "@repo/backend/test/content/stage";
import { Array as Arr, Effect, Order, Schema, Stream } from "effect";

const artifactHash = Sha256HashSchema.make(`sha256:${"8".repeat(64)}`);
const technicalCopy = {
  de: {
    choice: "Technische Auswahl",
    contentHashCharacter: "3",
    country: "Technisches Land",
  },
  en: {
    choice: "Technical choice",
    contentHashCharacter: "1",
    country: "Technical country",
  },
  id: {
    choice: "Pilihan teknis",
    contentHashCharacter: "2",
    country: "Negara teknis",
  },
} as const satisfies Record<
  ActiveAppLocaleCode,
  {
    readonly choice: string;
    readonly contentHashCharacter: string;
    readonly country: string;
  }
>;

/** Creates one hashed technical try-out country row. */
export function makeTryoutCatalogRow(
  appLocale: ActiveAppLocaleCode = "en"
): Extract<
  ContentSnapshotRow,
  { readonly family: "tryout"; readonly rowKind: "catalog" }
> {
  const row = Schema.decodeSync(TryoutCatalogRowSchema)({
    countryCode: "ID",
    countryKey: "indonesia",
    graph: {
      alignmentId: "alignment:tryout:technical:country",
      assetId: `asset:${appLocale}:tryout:technical:country`,
      conceptId: "concept:tryout:technical:country",
      learningObjectId: "lo:tryout-technical-country",
      lensId: "lens:tryout:technical",
    },
    appLocale,
    kind: "country",
    order: 1,
    publicPath: "try-out/indonesia",
    sourceRevision: "technical-revision",
    title: technicalCopy[appLocale].country,
  });
  return {
    family: "tryout",
    record: makeTryoutCatalogRecord(row),
    rowKind: "catalog",
  };
}

/** Creates one hashed technical try-out question placement. */
export function makeTryoutPlacementRow(
  appLocale: ActiveAppLocaleCode = "en",
  artifacts?: Pick<
    TryoutPlacement,
    "answerArtifactHash" | "questionArtifactHash"
  >
): Extract<
  ContentSnapshotRow,
  { readonly family: "tryout"; readonly rowKind: "placement" }
> {
  const row = Schema.decodeSync(TryoutPlacementSchema)({
    answerArtifactHash: artifacts?.answerArtifactHash ?? artifactHash,
    answerArtifactLocale: appLocale,
    answerContentKey:
      "question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1/question-1/answer",
    contentHash: TryoutContentHashSchema.make(
      technicalCopy[appLocale].contentHashCharacter.repeat(64)
    ),
    countryKey: "indonesia",
    deliveryLanguage: appLocale,
    examKey: "snbt",
    appLocale,
    languagePolicy: { kind: "app-locale" },
    questionArtifactHash: artifacts?.questionArtifactHash ?? artifactHash,
    questionArtifactLocale: appLocale,
    questionContentKey:
      "question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1/question-1/question",
    questionOrder: 1,
    questionSourcePath:
      "packages/corpus/question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1/question-1",
    rendererDomain: "snbt-quant",
    response: {
      kind: "single-choice",
      options: [
        {
          isCorrect: true,
          label: technicalCopy[appLocale].choice,
          optionKey: "option-1",
          order: 1,
        },
        {
          isCorrect: false,
          label: `${technicalCopy[appLocale].choice} 2`,
          optionKey: "option-2",
          order: 2,
        },
      ],
    },
    scope: "server",
    sectionKey: "quantitative-knowledge",
    setKey: "set-1",
    sourceRevision: "technical-revision",
    trackKey: "2027",
  });
  return {
    family: "tryout",
    record: makeTryoutPlacementRecord(row),
    rowKind: "placement",
  };
}

/** Creates one self-authenticating technical try-out snapshot manifest. */
export const makeTryoutSnapshotManifest = Effect.fn(
  "backendTest.makeTryoutSnapshotManifest"
)(function* () {
  const catalog = Arr.sort(
    Arr.map(ACTIVE_APP_LOCALES, (appLocale) => makeTryoutCatalogRow(appLocale)),
    Order.mapInput(
      Order.String,
      (entry: ReturnType<typeof makeTryoutCatalogRow>) =>
        tryoutCatalogIdentity(entry.record.row)
    )
  );
  const placements = Arr.sort(
    Arr.map(ACTIVE_APP_LOCALES, (appLocale) =>
      makeTryoutPlacementRow(appLocale)
    ),
    Order.mapInput(
      Order.String,
      (entry: ReturnType<typeof makeTryoutPlacementRow>) =>
        tryoutPlacementIdentity(entry.record.row)
    )
  );
  const catalogEvidence = yield* digestTryoutCatalog(
    Stream.fromIterable(Arr.map(catalog, ({ record }) => record))
  );
  const placementEvidence = yield* digestTryoutPlacements(
    Stream.fromIterable(Arr.map(placements, ({ record }) => record))
  );
  const manifest = makeTryoutSnapshot({
    activeAppLocales: ACTIVE_APP_LOCALES,
    catalogDigest: catalogEvidence.digest,
    counts: {
      country: catalog.length,
      exam: 0,
      section: 0,
      set: 0,
      track: 0,
    },
    placementCount: placementEvidence.count,
    placementDigest: placementEvidence.digest,
    routeCount: catalog.length,
  });
  return {
    family: "tryout",
    manifest,
  } satisfies ContentSnapshotManifest;
});

/**
 * Activates exact schema-decoded try-out rows for one Convex integration test.
 *
 * Callers own the technical row values; this helper only applies the real
 * contract hashing, canonical storage, and active-release proof chain.
 */
export async function activateTryoutSnapshot(
  ctx: MutationCtx,
  input: {
    readonly catalog: readonly TryoutCatalogRow[];
    readonly placements: readonly TryoutPlacement[];
    readonly releaseId?: string;
  }
) {
  const activeAppLocales = Schema.decodeUnknownSync(ActiveAppLocaleListSchema)(
    Arr.filter(APP_LOCALE_CODES, (appLocale) =>
      Arr.some(input.catalog, (row) => row.appLocale === appLocale)
    )
  );
  const catalog = Arr.map(
    Arr.sort(
      input.catalog,
      Order.mapInput(Order.String, (row: TryoutCatalogRow) =>
        tryoutCatalogIdentity(row)
      )
    ),
    makeTryoutCatalogRecord
  );
  const placements = Arr.map(
    Arr.sort(
      input.placements,
      Order.mapInput(Order.String, (row: (typeof input.placements)[number]) =>
        tryoutPlacementIdentity(row)
      )
    ),
    makeTryoutPlacementRecord
  );
  const [catalogEvidence, placementEvidence] = await Effect.runPromise(
    Effect.all([
      digestTryoutCatalog(Stream.fromIterable(catalog)),
      digestTryoutPlacements(Stream.fromIterable(placements)),
    ])
  );
  const manifest: ContentSnapshotManifest = {
    family: "tryout",
    manifest: makeTryoutSnapshot({
      activeAppLocales,
      catalogDigest: catalogEvidence.digest,
      counts: countCatalog(input.catalog),
      placementCount: placementEvidence.count,
      placementDigest: placementEvidence.digest,
      routeCount: Arr.filter(
        input.catalog,
        (row) => "publicPath" in row && row.publicPath !== undefined
      ).length,
    }),
  };
  const snapshotId = manifest.manifest.snapshotId;
  const snapshots = {
    ...inheritContentSnapshots(null),
    tryout: replaceContentSnapshot({
      baseSnapshotId: null,
      resultSnapshotId: snapshotId,
      rowCount: catalog.length + placements.length,
      rowDigest: snapshotId,
    }),
  };
  const releaseId = input.releaseId ?? TEST_RELEASE_ID;
  await insertTestRelease(ctx, { activeAppLocales, releaseId, snapshots });
  await ctx.db.insert("contentSnapshots", {
    createdAt: 1,
    family: "tryout",
    retainUntil: Number.MAX_SAFE_INTEGER,
    snapshotId,
    snapshotJson: encodeSnapshotJson(manifest),
    verifiedAt: 1,
  });
  const catalogRows = Arr.map(catalog, (record, index) => ({ index, record }));
  for (const { index, record } of catalogRows) {
    await insertCatalogRecord(ctx, snapshotId, index, record);
  }
  const placementRows = Arr.map(placements, (record, offset) => ({
    offset,
    record,
  }));
  for (const { offset, record } of placementRows) {
    await insertPlacementRecord(
      ctx,
      snapshotId,
      catalog.length + offset,
      record
    );
  }
  const [release, state] = await Promise.all([
    ctx.db.query("contentReleases").unique(),
    ctx.db.query("contentState").unique(),
  ]);
  if (!(release && state)) {
    throw new Error("Expected one technical content release.");
  }
  await ctx.db.patch("contentReleases", release._id, {
    completedAt: 1,
    status: "completed",
  });
  await ctx.db.patch("contentState", state._id, {
    activeManifestHash: TEST_MANIFEST_HASH,
    activeReleaseId: releaseId,
    activeSequence: 1,
    candidateManifestHash: undefined,
    candidateReleaseId: undefined,
    candidateSequence: undefined,
  });
  return snapshotId;
}

/** Counts each catalog kind for the signed technical manifest. */
function countCatalog(rows: readonly TryoutCatalogRow[]) {
  return {
    country: Arr.filter(rows, ({ kind }) => kind === "country").length,
    exam: Arr.filter(rows, ({ kind }) => kind === "exam").length,
    section: Arr.filter(rows, ({ kind }) => kind === "section").length,
    set: Arr.filter(rows, ({ kind }) => kind === "set").length,
    track: Arr.filter(rows, ({ kind }) => kind === "track").length,
  };
}

/** Stores one canonical catalog record at its exact snapshot index. */
function insertCatalogRecord(
  ctx: MutationCtx,
  snapshotId: string,
  index: number,
  record: ReturnType<typeof makeTryoutCatalogRecord>
) {
  return ctx.db.insert("tryoutCatalog", {
    ...tryoutCatalogFacts(record),
    index,
    rowHash: record.rowHash,
    rowJson: canonicalizeContentSnapshotRow({
      family: "tryout",
      record,
      rowKind: "catalog",
    }),
    snapshotId,
  });
}

/** Stores one canonical placement record at its exact snapshot index. */
function insertPlacementRecord(
  ctx: MutationCtx,
  snapshotId: string,
  index: number,
  record: ReturnType<typeof makeTryoutPlacementRecord>
) {
  return ctx.db.insert("tryoutPlacements", {
    ...tryoutPlacementFacts(record),
    index,
    rowHash: record.rowHash,
    rowJson: canonicalizeContentSnapshotRow({
      family: "tryout",
      record,
      rowKind: "placement",
    }),
    snapshotId,
  });
}
