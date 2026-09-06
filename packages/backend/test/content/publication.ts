import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { canonicalizePublicPageProjection } from "@nakafa/aksara-contracts/projection/page";
import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import type { TableNames } from "@repo/backend/convex/_generated/dataModel";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeTestPageProjection } from "@repo/backend/test/content/page";
import {
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedArtifact,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import {
  testRouteJson,
  testTextHash,
} from "@repo/backend/test/content/release";
import { validate } from "convex-helpers/validators";
import { convexTest } from "convex-test";
import { Data, Effect, Predicate } from "effect";

export const TEST_PUBLICATION_RELEASE = testSignedRelease(
  testEmptyManifest(ReleaseIdSchema.make("publication-active"))
);

/** Creates a complete empty serving runtime with a real signed release envelope. */
export function makeRuntimeSource(
  signed: SignedContentRelease = TEST_PUBLICATION_RELEASE,
  resultFamilies: SignedContentRelease["manifest"]["scope"]["families"] = []
) {
  const source = new Map<TableNames, readonly unknown[]>();
  const state = {
    activeManifestHash: signed.manifestHash,
    activeReleaseId: signed.manifest.releaseId,
    activeSequence: 9,
    articleManifestHash: signed.manifestHash,
    articleReleaseId: signed.manifest.releaseId,
    articleSequence: 9,
    articleSlot: "blue",
    key: "primary",
    materialManifestHash: signed.manifestHash,
    materialReleaseId: signed.manifest.releaseId,
    materialSequence: 9,
    materialSlot: "blue",
    nextSequence: 10,
    searchManifestHash: signed.manifestHash,
    searchReleaseId: signed.manifest.releaseId,
    searchSequence: 9,
    searchSlot: "blue",
    updatedAt: 100,
  } satisfies PublicationRow<"contentState">;
  source.set("contentState", [state]);
  const release = {
    baseFamilies: [],
    checkedIndex: -1,
    checkedItems: 0,
    createdAt: 100,
    releaseId: signed.manifest.releaseId,
    releaseJson: JSON.stringify(signed),
    rendererJson: JSON.stringify(TEST_PROOF_RENDERER),
    resultFamilies: [...resultFamilies],
    role: "candidate",
    sequence: 9,
    stagedArtifacts: 0,
    stagedDeletes: 0,
    stagedItems: 0,
    stagedProjections: 0,
    stagedRoutes: 0,
    stagedSnapshotBatches: 0,
    stagedSnapshotRows: 0,
    stagedUpserts: 0,
    status: "completed",
    updatedAt: 100,
  } satisfies PublicationRow<"contentReleases">;
  source.set("contentReleases", [release]);
  return { source, state, release };
}

/** Creates one inherited public head with real signed bytes and its complete serving closure. */
export function makePageRuntimeSource(appLocale: ActiveAppLocaleCode = "en") {
  const fixture = makeRuntimeSource();
  const projection = makeTestPageProjection(appLocale);
  const projectionJson = canonicalizePublicPageProjection(projection);
  const artifact = testSignedArtifact("site", {
    artifactLocale: appLocale,
    contentKey: projection.contentKey,
  });
  const head = {
    artifactHash: artifact.artifactHash,
    artifactLocale: projection.artifactLocale,
    compilerConfigHash: artifact.payload.compilerConfigHash,
    contentKey: projection.contentKey,
    delivery: "public",
    family: "page",
    index: 0,
    operation: "upsert",
    projectionHash: testTextHash(projectionJson),
    projectionJson,
    releaseId: "inherited-release",
    rendererDomain: artifact.payload.rendererDomain,
    sequence: 7,
    sourceHash: artifact.payload.sourceHash,
    sourcePath: projection.sourcePath,
  } satisfies PublicationRow<"contentHeads">;
  const binding = {
    appLocale: projection.appLocale,
    batchHash: testTextHash("route batch"),
    batchIndex: 0,
    contentKey: projection.contentKey,
    index: 0,
    operation: "bind",
    publicPath: projection.publicPath,
    releaseId: head.releaseId,
    routeJson: testRouteJson({
      appLocale,
      contentKey: projection.contentKey,
      publicPath: projection.publicPath,
      releaseId: head.releaseId,
    }),
    sequence: head.sequence,
  } satisfies PublicationRow<"contentBindings">;
  fixture.source.set("contentHeads", [head]);
  fixture.source.set("contentBindings", [binding]);
  fixture.source.set("contentArtifacts", [
    {
      artifactHash: artifact.artifactHash,
      artifactJson: JSON.stringify(artifact),
      createdAt: 10,
      retainUntil: 1000,
    },
  ]);
  fixture.source.set("contentKeys", [
    {
      artifactLocale: projection.artifactLocale,
      contentKey: projection.contentKey,
      createdSequence: 7,
      family: "page",
    },
  ]);
  return { ...fixture, artifact, binding, head, projection };
}

/** Inserts schema-validated fixture rows and executes the real Convex query modules. */
export const createTestPublication = Effect.fn("TestContent.createPublication")(
  function* (source: ReadonlyMap<TableNames, readonly unknown[]>) {
    const runtime = yield* Effect.sync(() => convexTest(schema, convexModules));
    yield* Effect.tryPromise({
      try: () =>
        runtime.mutation(async (ctx) => {
          for (const [table, rows] of source) {
            for (const input of rows) {
              if (!Predicate.isObject(input)) {
                throw new TestPublicationError({
                  table,
                  cause: "Fixture row is not an object.",
                });
              }
              const row = Object.fromEntries(
                Object.entries(input).filter(
                  ([field]) => field !== "_id" && field !== "_creationTime"
                )
              );
              if (!validate(schema.tables[table].validator, row)) {
                throw new TestPublicationError({
                  table,
                  cause: "Fixture row violates its database contract.",
                });
              }
              await ctx.db.insert(table, row);
            }
          }
        }),
      catch: (cause) => new TestPublicationError({ cause }),
    });
    return runtime;
  }
);

/** Test boundary failure preserves the table and original validation cause. */
class TestPublicationError extends Data.TaggedError("TestPublicationError")<{
  readonly table?: TableNames;
  readonly cause: unknown;
}> {}
