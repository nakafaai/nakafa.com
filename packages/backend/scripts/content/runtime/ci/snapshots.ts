import { QuranSnapshotRowSchema } from "@nakafa/aksara-contracts/quran/snapshot/row";
import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import { ContentSnapshotKindSchema } from "@nakafa/aksara-contracts/release/snapshot/scope";
import { verifyContentSnapshots } from "@nakafa/aksara-contracts/release/snapshot/verify";
import { hashTryoutRuntimeBundlePayload } from "@nakafa/aksara-contracts/tryout/runtime/hash";
import {
  decodeRendererJson,
  decodeSnapshotJson,
  decodeSnapshotRowJson,
  decodeTryoutRuntimeBundleJson,
} from "@repo/backend/convex/contentRelease/parse";
import {
  verifyCurriculum,
  verifyProgram,
} from "@repo/backend/convex/contentRelease/program/verify";
import { quranSearchFacts } from "@repo/backend/convex/contentRelease/quran/facts";
import { verifyQuranRow } from "@repo/backend/convex/contentRelease/quran/verify";
import {
  verifyTryoutCatalog,
  verifyTryoutPlacement,
} from "@repo/backend/convex/contentRelease/tryout/verify";
import { contentRuntimeCiError } from "@repo/backend/scripts/content/runtime/ci/error";
import type { RuntimeTables } from "@repo/backend/scripts/content/runtime/tables";
import { Effect, Stream } from "effect";

/** Proves active family completeness with the same Aksara verifier as publication. */
export const validateRuntimeSnapshots = Effect.fn(
  "contentRuntime.validateSnapshotClosure"
)(function* (tables: RuntimeTables, signed: SignedContentRelease) {
  const manifests = yield* Effect.forEach(
    ContentSnapshotKindSchema.literals,
    (family) =>
      Effect.gen(function* () {
        const snapshotId = signed.manifest.snapshots[family].resultSnapshotId;
        const matches = tables.contentSnapshots.filter(
          (row) => row.family === family
        );
        if (snapshotId === null) {
          return [];
        }
        const stored = matches[0];
        if (
          matches.length !== 1 ||
          !stored ||
          stored.verifiedAt === undefined
        ) {
          return yield* contentRuntimeCiError(
            `Signed runtime lost its verified ${family} snapshot.`
          );
        }
        const snapshot = yield* decodeSnapshotJson(stored.snapshotJson);
        if (
          snapshot.family !== family ||
          snapshot.manifest.snapshotId !== snapshotId ||
          (snapshot.family === "quran" &&
            snapshot.manifest.provenanceStatus !== "approved")
        ) {
          return yield* contentRuntimeCiError(
            `Signed runtime ${family} snapshot disagrees with its active identity.`
          );
        }
        return [snapshot];
      })
  );
  const rowGroups = [
    [...tables.programCatalog, ...tables.curriculumRoutes],
    [...tables.quranRows],
    [...tables.tryoutCatalog, ...tables.tryoutPlacements],
  ];
  for (const rows of rowGroups) {
    rows.sort((left, right) => left.index - right.index);
    if (rows.some((row, index) => row.index !== index)) {
      return yield* contentRuntimeCiError(
        "Signed runtime snapshot has missing or duplicate row indexes."
      );
    }
  }
  yield* verifyContentSnapshots({
    manifests: Stream.fromIterable(manifests.flat()),
    previousSnapshots: null,
    rows: Stream.fromIterable(rowGroups.flat()).pipe(
      Stream.mapEffect((row) => decodeSnapshotRowJson(row.rowJson))
    ),
  }).pipe(
    Effect.mapError(() =>
      contentRuntimeCiError(
        "Signed runtime snapshot rows do not match their authenticated manifests."
      )
    )
  );
  for (const row of tables.programCatalog) {
    yield* verifyProgram(row, row.snapshotId);
  }
  for (const row of tables.curriculumRoutes) {
    yield* verifyCurriculum(row, row.snapshotId);
  }
  for (const row of tables.tryoutCatalog) {
    yield* verifyTryoutCatalog(row, row.snapshotId);
  }
  for (const row of tables.tryoutPlacements) {
    yield* verifyTryoutPlacement(row, row.snapshotId);
  }
  const search = new Map(tables.quranSearch.map((row) => [row.index, row]));
  if (search.size !== tables.quranSearch.length) {
    return yield* contentRuntimeCiError(
      "Signed runtime Quran search contains duplicate indexes."
    );
  }
  for (const row of tables.quranRows) {
    const payload = yield* verifyQuranRow(
      row,
      row.snapshotId,
      QuranSnapshotRowSchema.fields.payload
    );
    if (payload.kind !== "quran-search") {
      continue;
    }
    const expected = quranSearchFacts(payload);
    const stored = search.get(row.index);
    if (
      !stored ||
      stored.rowHash !== row.rowHash ||
      stored.identity !== expected.identity ||
      stored.appLocale !== expected.appLocale ||
      stored.assetId !== expected.assetId ||
      stored.surahNumber !== expected.surahNumber ||
      stored.text !== expected.text
    ) {
      return yield* contentRuntimeCiError(
        "Signed runtime Quran search lost its authenticated source row."
      );
    }
    search.delete(row.index);
  }
  if (search.size > 0) {
    return yield* contentRuntimeCiError(
      "Signed runtime contains orphaned Quran search rows."
    );
  }
  const snapshotId = signed.manifest.snapshots.tryout.resultSnapshotId;
  if (snapshotId === null) {
    return;
  }
  const stored = tables.tryoutRuntimeBundles[0];
  if (tables.tryoutRuntimeBundles.length !== 1 || !stored) {
    return yield* contentRuntimeCiError(
      "Signed runtime lost its active try-out bundle."
    );
  }
  const bundle = yield* decodeTryoutRuntimeBundleJson(stored.bundleJson);
  const renderer = yield* decodeRendererJson(stored.rendererJson);
  if (
    stored.bundleHash !== bundle.bundleHash ||
    (yield* hashTryoutRuntimeBundlePayload(bundle.payload)) !==
      bundle.bundleHash ||
    stored.snapshotId !== snapshotId ||
    bundle.payload.snapshot.snapshotId !== snapshotId ||
    stored.rendererManifestHash !== signed.manifest.rendererManifestHash ||
    bundle.payload.rendererManifestHash !== stored.rendererManifestHash ||
    renderer.hash !== stored.rendererManifestHash ||
    stored.sourceGitSha !== bundle.payload.sourceGitSha ||
    stored.sourceManifestHash !== bundle.payload.sourceManifestHash ||
    stored.sourceReleaseId !== bundle.payload.sourceReleaseId
  ) {
    return yield* contentRuntimeCiError(
      "Signed runtime try-out bundle disagrees with its active snapshot and renderer."
    );
  }
});
