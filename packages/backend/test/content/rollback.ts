import { DatabaseReader as ConfectDatabaseReader } from "@confect/server";
import { assert } from "@effect/vitest";
import type { ContentDeliveryClass } from "@nakafa/aksara-contracts/delivery";
import {
  ContentKeySchema,
  CorpusSourcePathSchema,
  PublicPathSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { MAX_CONTENT_TREE_BYTES } from "@nakafa/aksara-contracts/limits";
import {
  ACTIVE_APP_LOCALE_CODES,
  ArtifactLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import {
  canonicalizeRollbackPage,
  canonicalizeRollbackSnapshotEntry,
  MAX_ROLLBACK_PAGE_BYTES,
  type RollbackPage,
  type RollbackRecord,
  RollbackSnapshotEntrySchema,
} from "@nakafa/aksara-contracts/release/rollback/spec";
import { inheritContentSnapshots } from "@nakafa/aksara-contracts/release/snapshot/spec";
import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";
import {
  type ContentTreeElement,
  canonicalizeContentTree,
} from "@nakafa/aksara-contracts/tree";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { rollbackRecord } from "@repo/backend/confect/contentRelease/rollback/state";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type schema from "@repo/backend/convex/schema";
import {
  insertTestArtifact,
  testArtifactJson,
} from "@repo/backend/test/content/artifact";
import {
  testMaterialPublicPath,
  testProjectionJson,
} from "@repo/backend/test/content/material";
import { testSignedArtifact } from "@repo/backend/test/content/proof";
import {
  TEST_DIGEST,
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
  testRollbackJson,
  testRouteJson,
  testTextHash,
  testUpsertJson,
} from "@repo/backend/test/content/release";
import { insertTestRelease } from "@repo/backend/test/content/stage";
import { encodeJsonText } from "@repo/utilities/json";
import type { TestConvex } from "convex-test";
import { Array as Arr, Effect, Option, Schema } from "effect";

const NOW = Date.UTC(2026, 6, 23, 12);
type RollbackFixtureFamily = "material" | "question";

/** Inserts one signed route owner into a rollback fixture. */
export function insertRoute(
  ctx: MutationCtx,
  fixture: {
    readonly contentKey: string;
    readonly index: number;
    readonly operation?: "bind" | "delete";
    readonly publicPath: string;
    readonly releaseId?: string;
    readonly sequence?: number;
  }
) {
  const operation = fixture.operation ?? "bind";
  const releaseId = fixture.releaseId ?? TEST_RELEASE_ID;
  const sequence = fixture.sequence ?? 1;

  return ctx.db.insert("contentBindings", {
    batchHash: TEST_DIGEST,
    batchIndex: 0,
    contentKey: fixture.contentKey,
    index: fixture.index,
    appLocale: "en",
    operation,
    publicPath: fixture.publicPath,
    releaseId,
    routeJson: testRouteJson({
      contentKey: fixture.contentKey,
      index: fixture.index,
      operation,
      publicPath: fixture.publicPath,
      releaseId,
    }),
    sequence,
  });
}

/** Produces one unique immutable artifact identity for a rollback fixture. */
export function rollbackArtifactHash(index: number, slot: "current" | "prior") {
  const offset = slot === "current" ? index + 1 : index + 100;
  return Sha256HashSchema.make(
    `sha256:${offset.toString(16).padStart(64, "0")}`
  );
}

/** Makes one release the completed active source for rollback preparation. */
export async function activateRollbackFixture(
  ctx: MutationCtx,
  itemCount: number,
  routeCount = itemCount
) {
  await insertTestRelease(ctx, {
    checkedIndex: itemCount - 1,
    checkedItems: itemCount,
    itemCount,
    projectionCount: itemCount,
    routeCount,
    stagedArtifacts: itemCount,
    stagedItems: itemCount,
    stagedProjections: itemCount,
    stagedRoutes: routeCount,
    stagedUpserts: itemCount,
  });
  const release = await ctx.db.query("contentReleases").unique();
  const state = await ctx.db.query("contentState").unique();
  assert.ok(release && state, "Expected release fixtures.");
  const receipt = {
    activatedHeads: itemCount,
    activeAppLocales: ACTIVE_APP_LOCALE_CODES,
    deletedHeads: 0,
    manifestHash: TEST_MANIFEST_HASH,
    projectionDigest: TEST_DIGEST,
    releaseId: TEST_RELEASE_ID,
    resultCount: itemCount,
    resultDigest: TEST_DIGEST,
    routeDigest: TEST_DIGEST,
    snapshots: inheritContentSnapshots(null),
    stagedArtifacts: itemCount,
    stagedItems: itemCount,
    stagedProjections: itemCount,
    stagedRoutes: routeCount,
    stagedSnapshotRows: 0,
  };
  await ctx.db.patch("contentReleases", release._id, {
    completedAt: NOW,
    proofAt: NOW,
    proofJson: "{}",
    receiptJson: encodeJsonText(receipt),
    status: "completed",
    verifiedAt: NOW,
  });
  await ctx.db.patch("contentState", state._id, {
    activeManifestHash: TEST_MANIFEST_HASH,
    activeReleaseId: TEST_RELEASE_ID,
    activeSequence: release.sequence,
    candidateManifestHash: undefined,
    candidateReleaseId: undefined,
    candidateSequence: undefined,
  });
}

/** Inserts one immutable content version and its signed artifact. */
async function insertVersion(
  ctx: MutationCtx,
  options: {
    readonly artifactHash: string;
    readonly contentKey: string;
    readonly delivery: ContentDeliveryClass;
    readonly family: RollbackFixtureFamily;
    readonly index: number;
    readonly projectionJson: string;
    readonly releaseId: string;
    readonly rendererDomain: RendererDomain;
    readonly sequence: number;
    readonly sourceHash?: typeof Sha256HashSchema.Type;
    readonly sourcePath: string;
  },
  bodyText: string,
  artifactJson = testArtifactJson({
    artifactHash: options.artifactHash,
    bodyText,
    contentKey: options.contentKey,
    rendererDomain: options.rendererDomain,
  })
) {
  await ctx.db.insert("contentHeads", {
    artifactHash: options.artifactHash,
    compilerConfigHash: TEST_DIGEST,
    contentKey: options.contentKey,
    delivery: options.delivery,
    family: options.family,
    index: options.index,
    artifactLocale: "en",
    operation: "upsert",
    projectionHash: testTextHash(options.projectionJson),
    projectionJson: options.projectionJson,
    releaseId: options.releaseId,
    rendererDomain: options.rendererDomain,
    sequence: options.sequence,
    sourceHash: options.sourceHash ?? TEST_DIGEST,
    sourcePath: options.sourcePath,
  });
  await insertTestArtifact(ctx, {
    artifactHash: options.artifactHash,
    artifactJson,
  });
}

/** Inserts one exact current body plus its signed prior rollback state. */
export async function insertRollbackItem(
  ctx: MutationCtx,
  index: number,
  previousExists: boolean,
  bodyText = "Technical fixture",
  options?: {
    readonly authenticatedArtifact?: boolean;
    readonly contentKey?: typeof ContentKeySchema.Type;
    readonly currentArtifactJson?: string;
    readonly currentProjectionJson?: string;
    readonly currentSourcePath?: typeof CorpusSourcePathSchema.Type;
    readonly delivery?: ContentDeliveryClass;
    readonly family?: RollbackFixtureFamily;
    readonly priorProjectionJson?: string;
    readonly priorSourcePath?: typeof CorpusSourcePathSchema.Type;
    readonly rendererDomain?: RendererDomain;
  }
) {
  const delivery = options?.delivery ?? "public";
  const family = options?.family ?? "material";
  const contentKey =
    options?.contentKey ?? ContentKeySchema.make(`test:head-${index}`);
  const rendererDomain = options?.rendererDomain ?? "mathematics";
  const signedArtifact = options?.authenticatedArtifact
    ? await Effect.runPromise(
        testSignedArtifact(rendererDomain, { bodyText, contentKey })
      )
    : undefined;
  const currentHash =
    signedArtifact?.artifactHash ?? rollbackArtifactHash(index, "current");
  const currentProjection =
    options?.currentProjectionJson ?? testProjectionJson({ contentKey, index });
  const currentSourcePath =
    options?.currentSourcePath ??
    CorpusSourcePathSchema.make(`packages/corpus/test/head-${index}/en.mdx`);
  const priorHash = rollbackArtifactHash(index, "prior");
  const priorPath = PublicPathSchema.make(testMaterialPublicPath(index + 100));
  const priorProjection =
    options?.priorProjectionJson ??
    testProjectionJson({ contentKey, index: index + 100 });
  const priorSourcePath =
    options?.priorSourcePath ??
    CorpusSourcePathSchema.make(`packages/corpus/test/prior-${index}/en.mdx`);
  const rollbackJson = previousExists
    ? canonicalizeRollbackSnapshotEntry(
        Schema.decodeUnknownSync(RollbackSnapshotEntrySchema)({
          index,
          releaseId: TEST_RELEASE_ID,
          snapshot: {
            head: {
              artifactHash: priorHash,
              compilerConfigHash: Sha256HashSchema.make(TEST_DIGEST),
              contentKey,
              delivery,
              family,
              artifactLocale: ArtifactLocaleSchema.make("en"),
              projectionHash: Sha256HashSchema.make(
                testTextHash(priorProjection)
              ),
              ...(family === "question" ? {} : { publicPath: priorPath }),
              rendererDomain,
              sourceHash: Sha256HashSchema.make(TEST_DIGEST),
              sourcePath: priorSourcePath,
            },
            state: family,
          },
        })
      )
    : testRollbackJson({ contentKey, family, index });
  await ctx.db.insert("contentItems", {
    artifactHash: currentHash,
    artifactBatchHash: TEST_DIGEST,
    artifactBatchIndex: 0,
    artifactReady: true,
    contentKey,
    index,
    itemBatchHash: TEST_DIGEST,
    itemBatchIndex: 0,
    itemJson: testUpsertJson({
      artifactHash: currentHash,
      contentKey,
      delivery,
      family,
      index,
      rendererDomain,
      sourcePath: currentSourcePath,
    }),
    artifactLocale: "en",
    ...(previousExists ? { priorSequence: 0 } : {}),
    projectionBatchHash: TEST_DIGEST,
    projectionBatchIndex: 0,
    projectionJson: currentProjection,
    projectionReady: true,
    releaseId: TEST_RELEASE_ID,
    rollbackJson,
    sequence: 1,
    stagedAt: NOW,
  });
  await insertVersion(
    ctx,
    {
      artifactHash: currentHash,
      contentKey,
      delivery,
      family,
      index,
      projectionJson: currentProjection,
      releaseId: TEST_RELEASE_ID,
      rendererDomain,
      sequence: 1,
      ...(signedArtifact?.payload.sourceHash === undefined
        ? {}
        : { sourceHash: signedArtifact?.payload.sourceHash }),
      sourcePath: currentSourcePath,
    },
    bodyText,
    signedArtifact
      ? encodeJsonText(signedArtifact)
      : options?.currentArtifactJson
  );
  if (previousExists) {
    await insertVersion(
      ctx,
      {
        artifactHash: priorHash,
        contentKey,
        delivery,
        family,
        index,
        projectionJson: priorProjection,
        releaseId: "release-prior",
        rendererDomain,
        sequence: 0,
        sourcePath: priorSourcePath,
      },
      bodyText
    );
  }
}

/**
 * The reference for the page walk that prepareRollback replaced: every candidate page is
 * canonicalized whole before the next row is considered, and the accepted page once more.
 */
function perRowCanonicalPage(
  afterIndex: number,
  total: number,
  rows: readonly RollbackRecord[]
) {
  const pageOf = (records: readonly RollbackRecord[]): RollbackPage => {
    const nextIndex = Option.match(Arr.last(records), {
      onNone: () => afterIndex,
      onSome: (record) => record.index,
    });
    return {
      done: nextIndex === total - 1,
      nextIndex,
      records,
      rollbackOf: TEST_RELEASE_ID,
      rollbackOfManifestHash: TEST_MANIFEST_HASH,
      total,
    };
  };
  let accepted: RollbackRecord[] = [];
  for (const record of rows) {
    const candidate = pageOf([...accepted, record]);
    const bytes = new TextEncoder().encode(
      canonicalizeRollbackPage(candidate)
    ).byteLength;
    if (bytes > MAX_ROLLBACK_PAGE_BYTES) {
      break;
    }
    accepted = [...accepted, record];
  }
  return canonicalizeRollbackPage(pageOf(accepted));
}

/** Computes the page text prepareRollback must return for the same stored rows. */
export function expectedRollbackPage(
  t: TestConvex<typeof schema>,
  afterIndex: number,
  limit: number,
  total: number
) {
  return t.query(async (ctx) => {
    const rows = await ctx.db
      .query("contentItems")
      .withIndex("by_releaseId_and_index", (query) =>
        query.eq("releaseId", TEST_RELEASE_ID).gt("index", afterIndex)
      )
      .take(limit);
    const records = await Effect.runPromise(
      Effect.forEach(rows, (row) => rollbackRecord(row)).pipe(
        Effect.map((transitions) =>
          Arr.map(transitions, ({ record }) => record)
        ),
        Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
      )
    );
    return perRowCanonicalPage(afterIndex, total, records);
  });
}

/** Props per element in the props-dense fixture tree. */
const PROPS_PER_ELEMENT = 62;

/** Builds a fragment of em elements with 62 props each, filling the tree to just under its ceiling. */
function propsDenseTree(): ContentTreeElement {
  const props: Record<string, string> = {};
  for (let index = 0; index < PROPS_PER_ELEMENT; index += 1) {
    props[`p${index}`] = "x";
  }
  const element: ContentTreeElement = {
    $node: "element",
    name: "em",
    props,
    children: [],
  };
  const elementBytes = new TextEncoder().encode(
    canonicalizeContentTree(element)
  ).byteLength;
  const count = Math.floor(
    (MAX_CONTENT_TREE_BYTES - 4 * 1024) / (elementBytes + 1)
  );
  return {
    $node: "element",
    name: "fragment",
    props: {},
    children: Arr.makeBy(count, () => element),
  };
}

/**
 * The props-dense signed artifact of one rollback row, in the text its fixture writes. Its props keep
 * insertion order, so the text is not the canonical form that ingress stores.
 */
export function propsDenseArtifactJson(index: number) {
  return testArtifactJson({
    artifactHash: rollbackArtifactHash(index, "current"),
    contentKey: `test:head-${index}`,
    contentTree: propsDenseTree(),
  });
}
