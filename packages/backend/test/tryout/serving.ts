import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import {
  inheritContentSnapshots,
  replaceContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import type { TryoutCatalogRow } from "@nakafa/aksara-contracts/tryout/catalog";
import type { TryoutPlacement } from "@nakafa/aksara-contracts/tryout/placement";
import { decodeSnapshotJson } from "@repo/backend/confect/contentRelease/parse";
import { mergeManagedFamilies } from "@repo/backend/confect/contentRelease/scope/family";
import { convexModules } from "@repo/backend/confect/test.setup";
import schema from "@repo/backend/convex/schema";
import {
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedArtifact,
  testSignedRelease,
  testSignedTryoutRuntimeBundle,
} from "@repo/backend/test/content/proof";
import { makeRuntimeSource } from "@repo/backend/test/content/publication";
import { testPublicationScope } from "@repo/backend/test/content/release";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout/snapshot";
import {
  makeTryoutStartHierarchy,
  makeTryoutStartPlacement,
} from "@repo/backend/test/tryout/source";
import { encodeJsonText } from "@repo/utilities/json";
import { convexTest } from "convex-test";
import { Array as Arr, Effect, MutableHashMap, Option } from "effect";

/** Creates an inherited active try-out snapshot with authentic immutable bundle dependencies. */
export const makeTryoutRuntimeSource = Effect.fn(
  "RuntimeSnapshotTest.tryoutSource"
)(function* (
  compiledCode?: string,
  input?: {
    readonly catalog: readonly TryoutCatalogRow[];
    readonly placements: readonly TryoutPlacement[];
  }
) {
  const t = convexTest(schema, convexModules);
  const catalog =
    input?.catalog ??
    Arr.flatMap(ACTIVE_APP_LOCALE_CODES, (appLocale) =>
      makeTryoutStartHierarchy(appLocale, "visible")
    );
  const sourcePlacements =
    input?.placements ??
    Arr.map(ACTIVE_APP_LOCALE_CODES, makeTryoutStartPlacement);
  const artifacts = Arr.flatMap(sourcePlacements, (placement) => [
    testSignedArtifact(placement.rendererDomain, {
      contentKey: placement.questionContentKey,
      artifactLocale: placement.questionArtifactLocale,
      compiledCode:
        compiledCode ??
        'return { default: function TechnicalQuestion() { return "Technical question"; } };',
    }),
    testSignedArtifact(placement.rendererDomain, {
      contentKey: placement.answerContentKey,
      artifactLocale: placement.answerArtifactLocale,
      ...(compiledCode === undefined ? {} : { compiledCode }),
    }),
  ]);
  const placements = Arr.map(sourcePlacements, (placement) => {
    const question = Arr.findFirst(
      artifacts,
      (artifact) =>
        artifact.payload.contentKey === placement.questionContentKey &&
        artifact.payload.artifactLocale === placement.questionArtifactLocale
    );
    const answer = Arr.findFirst(
      artifacts,
      (artifact) =>
        artifact.payload.contentKey === placement.answerContentKey &&
        artifact.payload.artifactLocale === placement.answerArtifactLocale
    );
    if (!(Option.isSome(question) && Option.isSome(answer))) {
      throw new Error("Missing technical try-out artifacts.");
    }
    return {
      ...placement,
      questionArtifactHash: question.value.artifactHash,
      answerArtifactHash: answer.value.artifactHash,
    };
  });
  const snapshotId = yield* Effect.promise(() =>
    t.mutation((ctx) =>
      activateTryoutSnapshot(ctx, {
        catalog,
        placements,
      })
    )
  );
  const stored = yield* Effect.promise(() =>
    t.query((ctx) => ctx.db.query("contentSnapshots").unique())
  );
  if (!stored) {
    throw new Error("Missing technical try-out snapshot.");
  }
  const snapshot = yield* decodeSnapshotJson(stored.snapshotJson);
  if (snapshot.family !== "tryout") {
    throw new Error("Expected a technical try-out snapshot.");
  }
  const snapshots = {
    ...inheritContentSnapshots(null),
    tryout: replaceContentSnapshot({
      baseSnapshotId: null,
      resultSnapshotId: snapshot.manifest.snapshotId,
      rowCount: catalog.length + placements.length,
      rowDigest: snapshot.manifest.snapshotId,
    }),
  };
  const origin = testSignedRelease({
    ...testEmptyManifest(ReleaseIdSchema.make("tryout-origin")),
    scope: testPublicationScope({ snapshots }),
    snapshots,
  });
  const signed = testSignedRelease({
    ...testEmptyManifest(ReleaseIdSchema.make("tryout-active")),
    baseActiveAppLocales: origin.manifest.activeAppLocales,
    baseManifestHash: origin.manifestHash,
    baseReleaseId: origin.manifest.releaseId,
    snapshots: inheritContentSnapshots(snapshots),
  });
  const fixture = makeRuntimeSource(signed);
  const bundle = testSignedTryoutRuntimeBundle({
    release: origin,
    rendererManifest: TEST_PROOF_RENDERER,
    snapshot: snapshot.manifest,
  });
  MutableHashMap.set(fixture.source, "contentReleases", [
    {
      ...fixture.release,
      baseFamilies: [...origin.manifest.scope.families],
      resultFamilies: mergeManagedFamilies(
        origin.manifest.scope.families,
        signed.manifest.scope.families
      ),
      tryoutRuntimeBundleHash: bundle.bundleHash,
    },
  ]);
  MutableHashMap.set(
    fixture.source,
    "contentArtifacts",
    Arr.map(artifacts, (artifact) => ({
      artifactHash: artifact.artifactHash,
      artifactJson: encodeJsonText(artifact),
    }))
  );
  MutableHashMap.set(fixture.source, "tryoutRuntimeBundles", [
    {
      bundleHash: bundle.bundleHash,
      bundleJson: encodeJsonText(bundle),
      createdAt: 1,
      rendererJson: encodeJsonText(TEST_PROOF_RENDERER),
      rendererManifestHash: TEST_PROOF_RENDERER.hash,
      snapshotId,
      sourceGitSha: bundle.payload.sourceGitSha,
      sourceManifestHash: origin.manifestHash,
      sourceReleaseId: origin.manifest.releaseId,
    },
  ]);
  for (const table of [
    "contentSnapshots",
    "tryoutCatalog",
    "tryoutPlacements",
  ] as const) {
    MutableHashMap.set(
      fixture.source,
      table,
      yield* Effect.promise(() =>
        t.query((ctx) => ctx.db.query(table).collect())
      )
    );
  }
  return { ...fixture, bundle };
});
