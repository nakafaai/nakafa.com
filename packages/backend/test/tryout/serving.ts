import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import {
  inheritContentSnapshots,
  replaceContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import { decodeSnapshotJson } from "@repo/backend/convex/contentRelease/parse";
import { mergeManagedFamilies } from "@repo/backend/convex/contentRelease/scope/family";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedArtifact,
  testSignedRelease,
  testSignedTryoutRuntimeBundle,
} from "@repo/backend/test/content/proof";
import { testPublicationScope } from "@repo/backend/test/content/release";
import { makeRuntimeSource } from "@repo/backend/test/content/snapshot";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout/snapshot";
import {
  makeTryoutStartHierarchy,
  makeTryoutStartPlacement,
} from "@repo/backend/test/tryout/source";
import { convexTest } from "convex-test";
import { Effect } from "effect";

/** Creates an inherited active try-out snapshot with authentic immutable bundle dependencies. */
export const makeTryoutRuntimeSource = Effect.fn(
  "RuntimeSnapshotTest.tryoutSource"
)(function* (compiledCode?: string) {
  const t = convexTest(schema, convexModules);
  const artifacts = ACTIVE_APP_LOCALE_CODES.flatMap((appLocale) => {
    const placement = makeTryoutStartPlacement(appLocale);
    return [
      testSignedArtifact("tka-math", {
        contentKey: placement.questionContentKey,
        artifactLocale: appLocale,
        compiledCode:
          compiledCode ??
          'return { default: function TechnicalQuestion() { return "Technical question"; } };',
      }),
      testSignedArtifact("tka-math", {
        contentKey: placement.answerContentKey,
        artifactLocale: appLocale,
        compiledCode,
      }),
    ];
  });
  const placements = ACTIVE_APP_LOCALE_CODES.map((appLocale) => {
    const placement = makeTryoutStartPlacement(appLocale);
    const question = artifacts.find(
      (artifact) =>
        artifact.payload.contentKey === placement.questionContentKey &&
        artifact.payload.artifactLocale === appLocale
    );
    const answer = artifacts.find(
      (artifact) =>
        artifact.payload.contentKey === placement.answerContentKey &&
        artifact.payload.artifactLocale === appLocale
    );
    if (!(question && answer)) {
      throw new Error("Missing technical try-out artifacts.");
    }
    return {
      ...placement,
      questionArtifactHash: question.artifactHash,
      answerArtifactHash: answer.artifactHash,
    };
  });
  const snapshotId = yield* Effect.promise(() =>
    t.mutation((ctx) =>
      activateTryoutSnapshot(ctx, {
        catalog: ACTIVE_APP_LOCALE_CODES.flatMap((appLocale) =>
          makeTryoutStartHierarchy(appLocale, "visible")
        ),
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
      rowCount: 18,
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
  fixture.source.set(
    "contentReleases",
    (fixture.source.get("contentReleases") ?? []).map((row) => ({
      ...row,
      baseFamilies: [...origin.manifest.scope.families],
      resultFamilies: mergeManagedFamilies(
        origin.manifest.scope.families,
        signed.manifest.scope.families
      ),
      tryoutRuntimeBundleHash: bundle.bundleHash,
    }))
  );
  fixture.source.set(
    "contentArtifacts",
    artifacts.map((artifact) => ({
      artifactHash: artifact.artifactHash,
      artifactJson: JSON.stringify(artifact),
      createdAt: 1,
      retainUntil: 100,
    }))
  );
  fixture.source.set("tryoutRuntimeBundles", [
    {
      bundleHash: bundle.bundleHash,
      bundleJson: JSON.stringify(bundle),
      createdAt: 1,
      rendererJson: JSON.stringify(TEST_PROOF_RENDERER),
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
    fixture.source.set(
      table,
      yield* Effect.promise(() =>
        t.query((ctx) => ctx.db.query(table).collect())
      )
    );
  }
  return { ...fixture, bundle };
});
