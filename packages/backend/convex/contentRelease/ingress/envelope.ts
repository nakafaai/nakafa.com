"use node";

import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import { verifySignedContentRelease } from "@nakafa/aksara-contracts/release/verify";
import type { RendererManifestEnvelope } from "@nakafa/aksara-contracts/renderer/contract";
import { validateRendererManifestHash } from "@nakafa/aksara-contracts/renderer/manifest";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import {
  decodeReleaseJson,
  decodeRendererJson,
} from "@repo/backend/convex/contentRelease/parse";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import { hasRendererIdentity } from "@repo/backend/convex/contentRelease/renderer";
import type { releaseRoleValidator } from "@repo/backend/convex/contentRelease/spec";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { Effect } from "effect";

interface StoredEnvelope {
  readonly releaseJson: string;
  readonly rendererJson: string;
  readonly role: Infer<typeof releaseRoleValidator>;
}

const releaseEnvelopeReference = makeFunctionReference<
  "query",
  { releaseId: string },
  StoredEnvelope
>("contentRelease/envelope:byRelease");

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
  if (!hasRendererIdentity(signed.manifest, renderer)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Signed release does not own the supplied renderer snapshot."
    );
  }
  return { renderer, signed };
});

/** Loads and verifies the release envelope owning one staged batch. */
export const loadStageEnvelope = Effect.fn("contentRelease.loadStageEnvelope")(
  function* (ctx: ActionCtx, releaseId: string) {
    const stored = yield* callInternal(() =>
      ctx.runQuery(releaseEnvelopeReference, { releaseId })
    );
    const release = yield* decodeReleaseJson(stored.releaseJson);
    const renderer = yield* decodeRendererJson(stored.rendererJson);
    const verified = yield* validateReleaseRenderer(release, renderer);
    if (verified.signed.manifest.releaseId !== releaseId) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Staged release identity does not match its stored envelope."
      );
    }
    return { ...verified, role: stored.role };
  }
);
