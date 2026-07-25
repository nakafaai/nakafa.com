"use node";

import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import {
  ContentReleaseCurrentSchema,
  RecoveryLookupSchema,
} from "@nakafa/aksara-contracts/release/current";
import { verifyContentReleaseBundle } from "@nakafa/aksara-contracts/release/verify";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { parseStoredJson } from "@repo/backend/convex/contentRelease/parse";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import type { recoveryLookupValidator } from "@repo/backend/convex/contentRelease/recovery";
import type { currentValidator } from "@repo/backend/convex/contentRelease/spec";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { Effect, Schema } from "effect";

type ReadContext = Pick<ActionCtx, "runQuery">;
interface StoredEnvelope {
  readonly releaseJson: string;
  readonly rendererJson: string;
}
type CurrentStatus = Infer<typeof currentValidator>;
type RecoveryLookup = Infer<typeof recoveryLookupValidator>;

const releaseEnvelopeReference = makeFunctionReference<
  "query",
  { releaseId: string },
  StoredEnvelope
>("contentRelease/envelope:byRelease");
const currentStatusReference = makeFunctionReference<
  "query",
  Record<string, never>,
  CurrentStatus
>("contentRelease/status:current");
const recoveryLookupReference = makeFunctionReference<
  "query",
  { recoveryId: string; releaseId: string },
  RecoveryLookup
>("contentRelease/recovery:lookup");

/** Authenticates one exact release and renderer bundle recovered from storage. */
export const decodeStoredBundle = Effect.fn(
  "contentRelease.decodeStoredBundle"
)(function* (releaseJson: string, rendererJson: string) {
  const release = yield* parseStoredJson(releaseJson, "Signed release");
  const rendererManifest = yield* parseStoredJson(
    rendererJson,
    "Renderer manifest"
  );
  return yield* verifyContentReleaseBundle({
    release,
    rendererManifest,
  }).pipe(Effect.mapError(contractFailure));
});

/** Loads and authenticates one stored release through its durable identity. */
export const loadVerifiedRelease = Effect.fn(
  "contentRelease.loadVerifiedRelease"
)(function* (ctx: ReadContext, releaseId: string) {
  const envelope = yield* callInternal(() =>
    ctx.runQuery(releaseEnvelopeReference, { releaseId })
  );
  const bundle = yield* decodeStoredBundle(
    envelope.releaseJson,
    envelope.rendererJson
  );
  if (bundle.release.manifest.releaseId !== releaseId) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Stored release ${releaseId} has an invalid signed identity.`
    );
  }
  return bundle;
});

/** Binds one authenticated release to the exact requested manifest identity. */
export const matchManifest = Effect.fn("contentRelease.matchManifest")(
  function* (
    release: SignedContentRelease,
    manifestHash: string,
    releaseId: string
  ) {
    if (release.manifestHash !== manifestHash) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Stored release ${releaseId} has an invalid manifest identity.`
      );
    }
  }
);

/** Reads and authenticates active, candidate, and recovery release bundles. */
export const readCurrentPublication = Effect.fn(
  "contentRelease.readCurrentPublication"
)(function* (ctx: ReadContext) {
  const stored = yield* callInternal(() =>
    ctx.runQuery(currentStatusReference, {})
  );
  const active = stored.active
    ? {
        ...(yield* decodeStoredBundle(
          stored.active.releaseJson,
          stored.active.rendererJson
        )),
        receipt: stored.active.receipt,
      }
    : null;
  const candidate = stored.candidate
    ? {
        ...(yield* decodeStoredBundle(
          stored.candidate.releaseJson,
          stored.candidate.rendererJson
        )),
        phase: stored.candidate.phase,
      }
    : null;
  const recovery = stored.recovery
    ? {
        ...(yield* decodeStoredBundle(
          stored.recovery.releaseJson,
          stored.recovery.rendererJson
        )),
        phase: stored.recovery.phase,
      }
    : null;
  return yield* Schema.decodeUnknown(ContentReleaseCurrentSchema)(
    { active, candidate, recovery },
    { onExcessProperty: "error" }
  ).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: "Current release state violates its exact contract.",
        })
    )
  );
});

/** Authenticates one exact completed recovery or returns explicit absence. */
export const readRecovery = Effect.fn("contentRelease.readRecovery")(function* (
  ctx: ReadContext,
  request: { readonly recoveryId: string; readonly releaseId: string }
) {
  const stored = yield* callInternal(() =>
    ctx.runQuery(recoveryLookupReference, request)
  );
  if (stored.kind === "missing") {
    return stored;
  }
  const bundle = yield* decodeStoredBundle(
    stored.value.releaseJson,
    stored.value.rendererJson
  );
  const { manifest } = bundle.release;
  if (
    manifest.releaseId !== request.recoveryId ||
    manifest.origin.kind !== "rollback" ||
    manifest.origin.releaseId !== request.releaseId ||
    manifest.baseReleaseId !== request.releaseId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Recovery ${request.recoveryId} does not bind candidate ${request.releaseId}.`
    );
  }
  return yield* Schema.decodeUnknown(RecoveryLookupSchema)({
    kind: "completed",
    value: { ...bundle, receipt: stored.value.receipt },
  }).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Recovery ${request.recoveryId} lost terminal evidence.`,
        })
    )
  );
});
