"use node";

import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import { verifySignedContentRelease } from "@nakafa/aksara-contracts/release/verify";
import type { RendererManifestEnvelope } from "@nakafa/aksara-contracts/renderer/contract";
import { validateRendererManifestHash } from "@nakafa/aksara-contracts/renderer/manifest";
import refs from "@repo/backend/confect/_generated/refs";
import { QueryRunner } from "@repo/backend/confect/_generated/services";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  decodeReleaseJson,
  decodeRendererJson,
} from "@repo/backend/confect/contentRelease/parse";
import { contractFailure } from "@repo/backend/confect/contentRelease/proof/failure";
import { Effect } from "effect";
/** Validates that one signed release owns the supplied renderer snapshot. */
export const validateReleaseRenderer = Effect.fn(
  "contentRelease.validateReleaseRenderer"
)(function* (
  release: SignedContentRelease,
  rendererInput: RendererManifestEnvelope
) {
  const signed = yield* verifySignedContentRelease(release).pipe(
    Effect.mapError(contractFailure)
  );
  const renderer = yield* validateRendererManifestHash(rendererInput).pipe(
    Effect.mapError(contractFailure)
  );
  if (signed.manifest.rendererManifestHash !== renderer.hash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Signed release does not own the supplied renderer snapshot."
    );
  }
  return {
    renderer,
    signed,
  };
});

/** Loads and verifies the release envelope owning one staged batch. */
export const loadStageEnvelope = Effect.fn("contentRelease.loadStageEnvelope")(
  function* (releaseId: string) {
    const runQuery = yield* QueryRunner;
    const stored = yield* runQuery(
      refs.internal.contentRelease.envelope.byRelease,
      {
        releaseId,
      }
    ).pipe(Effect.catchTag("SchemaError", Effect.die));
    const release = yield* decodeReleaseJson(stored.releaseJson);
    const renderer = yield* decodeRendererJson(stored.rendererJson);
    const verified = yield* validateReleaseRenderer(release, renderer);
    if (verified.signed.manifest.releaseId !== releaseId) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Staged release identity does not match its stored envelope."
      );
    }
    return {
      ...verified,
      role: stored.role,
    };
  }
);
