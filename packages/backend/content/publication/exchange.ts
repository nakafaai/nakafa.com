import {
  CorpusSourcePathSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { canonicalizeContentProjection } from "@nakafa/aksara-contracts/projection/spec";
import type { PublicContentRuntimeFound } from "@nakafa/aksara-contracts/runtime/spec";
import type { PublicRuntimeRow } from "@repo/backend/content/publication/public";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import {
  decodeArtifactJson,
  decodeProjectionJson,
  decodeReleaseJson,
  decodeRendererJson,
} from "@repo/backend/convex/contentRelease/parse";
import { Effect, Schema } from "effect";
export class PublicRuntimeReadError extends Schema.TaggedError<PublicRuntimeReadError>()(
  "PublicRuntimeReadError",
  {}
) {}
/** Decodes one stored row into the exact Aksara public response. */
export const decodePublicRuntimeRow = Effect.fn(
  "contentRelease.decodePublicRuntimeRow"
)(function* (row: PublicRuntimeRow) {
  if (row === null) {
    return null;
  }
  const [artifact, projection, release, rendererManifest, sourcePath] =
    yield* Effect.all([
      decodeArtifactJson(row.artifactJson),
      decodeProjectionJson(row.projectionJson),
      decodeReleaseJson(row.releaseJson),
      decodeRendererJson(row.rendererJson),
      Schema.decodeEffect(CorpusSourcePathSchema)(row.sourcePath),
    ]).pipe(Effect.mapError(() => new PublicRuntimeReadError()));
  yield* Schema.decodeEffect(Sha256HashSchema)(row.projectionHash).pipe(
    Effect.mapError(() => new PublicRuntimeReadError())
  );
  const projectionJson = canonicalizeContentProjection(projection);
  const projectionHash = yield* hashText(
    "the current public content projection",
    projectionJson
  ).pipe(Effect.mapError(() => new PublicRuntimeReadError()));
  if (projection.kind === "question-body") {
    return yield* new PublicRuntimeReadError();
  }
  if (
    row.projectionHash !== projectionHash ||
    row.activeManifestHash !== release.manifestHash ||
    row.activeReleaseId !== release.manifest.releaseId
  ) {
    return yield* new PublicRuntimeReadError();
  }
  const response: PublicContentRuntimeFound = {
    activeManifestHash: release.manifestHash,
    activeReleaseId: release.manifest.releaseId,
    artifact,
    delivery: "public",
    kind: "found",
    projection,
    projectionHash,
    release,
    rendererManifest,
    sourcePath,
  };
  return response;
});
