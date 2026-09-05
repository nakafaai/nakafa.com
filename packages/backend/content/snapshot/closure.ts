import {
  canonicalizeContentProjection,
  familyForProjection,
} from "@nakafa/aksara-contracts/projection/spec";
import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import { validateRuntimeCatalogs } from "@repo/backend/content/snapshot/catalog";
import { contentSnapshotError } from "@repo/backend/content/snapshot/error";
import type { readPublishedContentState } from "@repo/backend/content/snapshot/selection";
import type {
  RuntimeRow,
  RuntimeTables,
} from "@repo/backend/content/snapshot/tables";
import { validateRuntimeSnapshots } from "@repo/backend/content/snapshot/verify";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import {
  decodeArtifactJson,
  decodeProjectionJson,
  decodeRendererJson,
} from "@repo/backend/convex/contentRelease/parse";
import { hasRendererIdentity } from "@repo/backend/convex/contentRelease/renderer";
import { Effect } from "effect";

/** Proves every retained serving row resolves within this exact active selection. */
export const validateActiveRuntime = Effect.fn(
  "contentRuntime.validateActiveClosure"
)(function* (
  tables: RuntimeTables,
  state: Effect.Success<ReturnType<typeof readPublishedContentState>>,
  release: RuntimeRow<"contentReleases">,
  signed: SignedContentRelease
) {
  const renderer = yield* decodeRendererJson(release.rendererJson);
  if (
    release.status !== "completed" ||
    release.sequence !== state.activeSequence ||
    signed.manifest.releaseId !== release.releaseId ||
    signed.manifestHash !== state.activeManifestHash ||
    !hasRendererIdentity(signed.manifest, renderer)
  ) {
    return yield* contentSnapshotError(
      "Signed runtime active release disagrees with its serving pointer."
    );
  }
  const artifacts = new Map(
    yield* Effect.forEach(tables.contentArtifacts, (row) =>
      decodeArtifactJson(row.artifactJson).pipe(
        Effect.map((artifact) => [row.artifactHash, artifact] as const)
      )
    )
  );
  const bindings = new Map(
    tables.contentBindings.map((row) => [
      JSON.stringify([row.contentKey, row.appLocale]),
      row,
    ])
  );
  if (
    artifacts.size !== tables.contentArtifacts.length ||
    bindings.size !== tables.contentBindings.length ||
    bindings.size !== tables.contentHeads.length
  ) {
    return yield* contentSnapshotError(
      "Signed runtime has duplicate artifacts or incomplete public route bindings."
    );
  }
  const projections = yield* Effect.forEach(tables.contentHeads, (head) =>
    Effect.gen(function* () {
      const binding = bindings.get(
        JSON.stringify([head.contentKey, head.artifactLocale])
      );
      const artifact = head.artifactHash
        ? artifacts.get(head.artifactHash)
        : undefined;
      if (
        !(binding && artifact && head.projectionJson && head.sourcePath) ||
        (head.sequence === binding.sequence &&
          head.releaseId !== binding.releaseId)
      ) {
        return yield* contentSnapshotError(
          "Signed runtime public head lost a route or artifact dependency."
        );
      }
      const projection = yield* decodeProjectionJson(head.projectionJson);
      if (
        artifact.artifactHash !== head.artifactHash ||
        artifact.payload.contentKey !== head.contentKey ||
        artifact.payload.artifactLocale !== head.artifactLocale ||
        artifact.payload.sourceHash !== head.sourceHash ||
        artifact.payload.compilerConfigHash !== head.compilerConfigHash ||
        artifact.payload.rendererDomain !== head.rendererDomain ||
        familyForProjection(projection) !== head.family ||
        projection.kind === "question-body" ||
        projection.contentKey !== head.contentKey ||
        projection.artifactLocale !== head.artifactLocale ||
        projection.appLocale !== binding.appLocale ||
        projection.publicPath !== binding.publicPath ||
        (yield* hashText(
          "public build projection",
          canonicalizeContentProjection(projection)
        )) !== head.projectionHash
      ) {
        return yield* contentSnapshotError(
          "Signed runtime public projection disagrees with its immutable head."
        );
      }
      return { head, projection };
    })
  );
  for (const placement of tables.tryoutPlacements) {
    for (const [hash, locale] of [
      [placement.questionArtifactHash, placement.questionArtifactLocale],
      [placement.answerArtifactHash, placement.answerArtifactLocale],
    ] as const) {
      const artifact = artifacts.get(hash);
      if (!artifact) {
        return yield* contentSnapshotError(
          "Signed runtime try-out placement lost an artifact dependency."
        );
      }
      if (
        artifact.artifactHash !== hash ||
        artifact.payload.artifactLocale !== locale
      ) {
        return yield* contentSnapshotError(
          "Signed runtime try-out artifact disagrees with its placement."
        );
      }
    }
  }
  yield* validateRuntimeCatalogs(tables, projections, state.activeSequence);
  yield* validateRuntimeSnapshots(tables, signed);
});
