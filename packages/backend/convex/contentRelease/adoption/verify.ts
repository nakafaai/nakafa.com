"use node";

import {
  selectVerifiedArtifactRenderer,
  verifySignedContentArtifact,
  verifySignedContentRelease,
  verifySignedTryoutRuntimeBundle,
} from "@nakafa/aksara-contracts/adoption/verify";
import {
  canonicalizeCompiledContentPayload,
  SignedContentArtifactSchema,
} from "@nakafa/aksara-contracts/content";
import { canonicalQuestionResponse } from "@nakafa/aksara-contracts/question/response";
import { SignedContentReleaseSchema } from "@nakafa/aksara-contracts/release";
import { tryoutCatalogNodeIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import {
  canonicalizeTryoutPlacement,
  makeTryoutPlacementRecord,
} from "@nakafa/aksara-contracts/tryout/placement-hash";
import { verifyTryoutRuntimeBundleSource } from "@nakafa/aksara-contracts/tryout/runtime/source";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { AdoptionState } from "@repo/backend/convex/contentRelease/adoption/spec";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  decodeArtifactJson,
  decodeReleaseJson,
  decodeRendererJson,
  decodeSnapshotJson,
  decodeTryoutRuntimeBundleJson,
} from "@repo/backend/convex/contentRelease/parse";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import { verifyTryoutPlacement } from "@repo/backend/convex/contentRelease/tryout/verify";
import { Effect, Schema } from "effect";

/** Reauthenticates both bundles and keeps the candidate's historical source claim truthful. */
export const verifyAdoptionState = Effect.fn(
  "contentRelease.adoption.verifyState"
)(function* (state: AdoptionState) {
  const oldRenderer = yield* decodeRendererJson(state.oldBundle.rendererJson);
  const newRenderer = yield* decodeRendererJson(state.newBundle.rendererJson);
  const prior = yield* verifySignedTryoutRuntimeBundle({
    bundle: yield* decodeTryoutRuntimeBundleJson(state.oldBundle.bundleJson),
    rendererManifest: oldRenderer,
  }).pipe(Effect.mapError(contractFailure));
  const next = yield* verifySignedTryoutRuntimeBundle({
    bundle: yield* decodeTryoutRuntimeBundleJson(state.newBundle.bundleJson),
    rendererManifest: newRenderer,
  }).pipe(Effect.mapError(contractFailure));
  const release = yield* verifySignedContentRelease(
    yield* decodeReleaseJson(state.release.releaseJson)
  ).pipe(Effect.mapError(contractFailure));
  if (
    !Schema.is(SignedContentReleaseSchema)(release) ||
    "rendererContractVersion" in release.manifest ||
    newRenderer.format !== "nakafa-mdx-renderer"
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_UNSUPPORTED",
      "Historical adoption must target the current renderer contract."
    );
  }
  yield* verifyTryoutRuntimeBundleSource({ bundle: next, release }).pipe(
    Effect.mapError(contractFailure)
  );
  const oldSnapshot = yield* decodeSnapshotJson(state.oldSnapshot.snapshotJson);
  const newSnapshot = yield* decodeSnapshotJson(state.newSnapshot.snapshotJson);
  const oldFacts = prior.payload.snapshot;
  const newFacts = next.payload.snapshot;
  if (
    oldSnapshot.family !== "tryout" ||
    newSnapshot.family !== "tryout" ||
    JSON.stringify(oldSnapshot.manifest) !== JSON.stringify(oldFacts) ||
    JSON.stringify(newSnapshot.manifest) !== JSON.stringify(newFacts) ||
    oldFacts.catalogDigest !== newFacts.catalogDigest ||
    oldFacts.placementCount !== newFacts.placementCount ||
    oldFacts.routeCount !== newFacts.routeCount ||
    JSON.stringify(oldFacts.counts) !== JSON.stringify(newFacts.counts) ||
    JSON.stringify(oldFacts.activeAppLocales) !==
      JSON.stringify(newFacts.activeAppLocales)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Historical adoption changed signed catalog facts."
    );
  }
  for (const pair of state.placements) {
    const oldRow = yield* verifyTryoutPlacement(
      pair.prior,
      state.oldBundle.snapshotId
    );
    const newRow = yield* verifyTryoutPlacement(
      pair.next,
      state.newBundle.snapshotId
    );
    if (
      makeTryoutPlacementRecord(oldRow).rowHash !== pair.prior.rowHash ||
      makeTryoutPlacementRecord(newRow).rowHash !== pair.next.rowHash ||
      canonicalizeTryoutPlacement({
        ...oldRow,
        questionArtifactHash: newRow.questionArtifactHash,
        answerArtifactHash: newRow.answerArtifactHash,
      }) !== canonicalizeTryoutPlacement(newRow)
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Historical placement changed beyond authenticated artifact hashes."
      );
    }
    for (const { attempt, placements } of state.history.entries) {
      for (const frozen of placements.filter(
        (item) => item.placementIdentity === pair.prior.identity
      )) {
        if (
          frozen.contentHash !== oldRow.contentHash ||
          frozen.sourceRevision !== oldRow.sourceRevision ||
          frozen.sourcePath !== oldRow.questionSourcePath ||
          frozen.questionContentKey !== oldRow.questionContentKey ||
          frozen.answerContentKey !== oldRow.answerContentKey ||
          frozen.rendererDomain !== oldRow.rendererDomain ||
          frozen.questionOrder !== oldRow.questionOrder ||
          frozen.sectionKey !== oldRow.sectionKey ||
          frozen.sectionIdentity !==
            tryoutCatalogNodeIdentity({ ...oldRow, kind: "section" }) ||
          JSON.stringify(frozen.responseSpec) !==
            JSON.stringify(canonicalQuestionResponse(oldRow.response)) ||
          attempt.appLocale !== oldRow.appLocale ||
          attempt.countryKey !== oldRow.countryKey ||
          attempt.examKey !== oldRow.examKey ||
          attempt.trackKey !== oldRow.trackKey ||
          attempt.setKey !== oldRow.setKey
        ) {
          return yield* releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            "Frozen learner placement differs from its signed source."
          );
        }
      }
    }
  }
  return { oldRenderer, newRenderer };
});

/** Proves the compiled function, raw source and all semantic payload fields are unchanged. */
export const verifyAdoptionArtifact = Effect.fn(
  "contentRelease.adoption.verifyArtifact"
)(function* (input: {
  prior: Doc<"contentArtifacts">;
  next: Doc<"contentArtifacts">;
  renderers: Effect.Success<ReturnType<typeof verifyAdoptionState>>;
}) {
  const prior = yield* verifySignedContentArtifact({
    artifact: yield* decodeArtifactJson(input.prior.artifactJson),
    rendererManifest: input.renderers.oldRenderer,
  }).pipe(Effect.mapError(contractFailure));
  const next = yield* verifySignedContentArtifact({
    artifact: yield* decodeArtifactJson(input.next.artifactJson),
    rendererManifest: input.renderers.newRenderer,
  }).pipe(Effect.mapError(contractFailure));
  const selection = yield* selectVerifiedArtifactRenderer(prior).pipe(
    Effect.mapError(contractFailure)
  );
  if (
    !Schema.is(SignedContentArtifactSchema)(next) ||
    prior.artifactHash !== input.prior.artifactHash ||
    next.artifactHash !== input.next.artifactHash ||
    canonicalizeCompiledContentPayload({
      ...prior.payload,
      requiredComponents: selection.requiredComponents,
    }) !== canonicalizeCompiledContentPayload(next.payload)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Historical artifact changed beyond renderer requirement metadata."
    );
  }
  return [
    {
      artifactHash: input.prior.artifactHash,
      jsonHash: yield* hashText(
        "adoption artifact bytes",
        input.prior.artifactJson
      ),
    },
    {
      artifactHash: input.next.artifactHash,
      jsonHash: yield* hashText(
        "adoption artifact bytes",
        input.next.artifactJson
      ),
    },
  ];
});
