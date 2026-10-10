import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  abortEvidence,
  validateAbortedRelease,
} from "@repo/backend/confect/contentRelease/abort";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { requireCurrentRelease } from "@repo/backend/confect/contentRelease/generation";
import {
  loadRelease,
  loadState,
  ownsRole,
} from "@repo/backend/confect/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/confect/contentRelease/parse";
import {
  completedReceipt,
  stagedEvidence,
} from "@repo/backend/confect/contentRelease/receipt";
import type {
  currentValidator,
  statusValidator,
} from "@repo/backend/confect/contentRelease/spec";
import { findReleaseTryoutRuntime } from "@repo/backend/confect/contentRelease/tryout/binding";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import { loadActiveIdentity } from "@repo/backend/content/publication/read";
import { Effect } from "effect";

type ReleaseStatus = typeof statusValidator.Type;
type CurrentStatus = typeof currentValidator.Type;
type ActiveBundle = NonNullable<CurrentStatus["active"]>;
type StagedBundle = NonNullable<CurrentStatus["candidate"]>;

/** Validates and returns one invisible slot's public lifecycle phase. */
const stagedPhase = Effect.fn("contentRelease.stagedPhase")(function* (
  release: Docs["contentReleases"]
) {
  const state = yield* loadState();
  if (!(state && ownsRole(state, release.role, release))) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Release ${release.releaseId} lost its ${release.role} slot.`
    );
  }
  const signed = yield* decodeReleaseJson(release.releaseJson);
  if (
    signed.manifest.releaseId !== release.releaseId ||
    (release.role === "candidate" &&
      signed.manifestHash !== state.candidateManifestHash) ||
    (release.role === "recovery" &&
      signed.manifestHash !== state.recoveryManifestHash)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Release ${release.releaseId} lost its signed slot identity.`
    );
  }
  if (release.status === "aborting") {
    yield* abortEvidence(release);
    return "aborting";
  }
  if (
    release.status !== "staging" &&
    release.status !== "verifying" &&
    release.status !== "verified"
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Release ${release.releaseId} has terminal state in an invisible slot.`
    );
  }
  yield* stagedEvidence(release, signed);
  return release.status;
});

/** Loads one exact stored bundle for an invisible candidate or recovery. */
const stagedBundle = Effect.fn("contentRelease.stagedBundle")(function* (
  releaseId: string | undefined
) {
  if (releaseId === undefined) {
    return null;
  }
  const release = yield* loadRelease(releaseId);
  return {
    phase: yield* stagedPhase(release),
    releaseJson: release.releaseJson,
    rendererJson: release.rendererJson,
  } satisfies StagedBundle;
});

/** Loads the completed active release and its optional permanent runtime pair. */
const activePublication = Effect.fn("contentRelease.activePublication")(
  function* () {
    const active = yield* loadActiveIdentity().pipe(
      Effect.provide(publicationLayer)
    );
    if (!active) {
      return null;
    }
    const runtime = yield* findReleaseTryoutRuntime(
      active.signed,
      active.release.tryoutRuntimeBundleHash
    );
    return {
      active: {
        receipt: yield* completedReceipt(active.release, active.signed),
        releaseJson: active.release.releaseJson,
        rendererJson: active.release.rendererJson,
      } satisfies ActiveBundle,
      tryoutRuntimeBundleJson: runtime.result?.stored.bundleJson ?? null,
    };
  }
);

/** Reads authenticated recovery bytes for the singleton publication state. */
export const currentProgram = Effect.fn("contentRelease.current")(function* () {
  const state = yield* loadState();
  if (!state) {
    return {
      active: null,
      candidate: null,
      recovery: null,
      tryoutRuntimeBundleJson: null,
    } satisfies CurrentStatus;
  }
  const publication = yield* activePublication();
  return {
    active: publication?.active ?? null,
    candidate: yield* stagedBundle(state.candidateReleaseId),
    recovery: yield* stagedBundle(state.recoveryReleaseId),
    tryoutRuntimeBundleJson: publication?.tryoutRuntimeBundleJson ?? null,
  } satisfies CurrentStatus;
});

/** Reads one indexed release phase without exposing publication internals. */
export const statusProgram = Effect.fn("contentRelease.status")(function* (
  manifestHash: string,
  releaseId: string
) {
  const database = yield* DatabaseReader;
  const release = yield* database
    .table("contentReleases")
    .get("by_releaseId", releaseId)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (!release) {
    return {
      manifestHash,
      phase: "missing",
      releaseId,
    } satisfies ReleaseStatus;
  }
  yield* requireCurrentRelease(release.releaseJson, releaseId);
  const signed = yield* decodeReleaseJson(release.releaseJson);
  if (signed.manifestHash !== manifestHash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Content release ${releaseId} was requested with another manifest.`
    );
  }
  if (release.status === "completed") {
    yield* findReleaseTryoutRuntime(signed, release.tryoutRuntimeBundleHash);
    return {
      manifestHash,
      phase: "completed",
      receipt: yield* completedReceipt(release, signed),
      releaseId,
    } satisfies ReleaseStatus;
  }
  if (release.status === "aborted") {
    yield* validateAbortedRelease(releaseId);
    return {
      manifestHash,
      phase: "aborted",
      releaseId,
    } satisfies ReleaseStatus;
  }
  return {
    manifestHash,
    phase: yield* stagedPhase(release),
    releaseId,
  } satisfies ReleaseStatus;
});
