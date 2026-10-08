import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  validateCandidateBase,
  validateExistingSnapshots,
  validateRecoveryBase,
} from "@repo/backend/confect/contentRelease/base";
import { ensureDocumentSize } from "@repo/backend/confect/contentRelease/document";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { ensureState } from "@repo/backend/confect/contentRelease/model";
import {
  decodeReleaseJson,
  decodeRendererJson,
} from "@repo/backend/confect/contentRelease/parse";
import { releaseReachability } from "@repo/backend/confect/contentRelease/reachability";
import { completedReceipt } from "@repo/backend/confect/contentRelease/receipt";
import {
  deriveReleaseFamilies,
  hasExactFamilies,
  loadReleaseFamilies,
} from "@repo/backend/confect/contentRelease/scope/family";
import type { statusValidator } from "@repo/backend/confect/contentRelease/spec";
import {
  encodeReleaseJson,
  encodeRendererJson,
} from "@repo/backend/confect/contentRelease/wire";
import type { WithoutSystemFields } from "convex/server";
import { Clock, Effect } from "effect";
export type ReleaseRole = Docs["contentReleases"]["role"];
export type ReleaseStatus = typeof statusValidator.Type;

/** Projects one durable release into its exact shared lifecycle status. */
export const releaseStatus = Effect.fn("contentRelease.releaseStatus")(
  function* (release: Docs["contentReleases"]) {
    const signed = yield* decodeReleaseJson(release.releaseJson);
    if (release.status === "completed") {
      return {
        manifestHash: signed.manifestHash,
        phase: "completed",
        receipt: yield* completedReceipt(release, signed),
        releaseId: release.releaseId,
      } satisfies ReleaseStatus;
    }
    return {
      manifestHash: signed.manifestHash,
      phase: release.status,
      releaseId: release.releaseId,
    } satisfies ReleaseStatus;
  }
);

/** Confirms an idempotent release still owns the same immutable role slot. */
export const validateExisting = Effect.fn("contentRelease.validateExisting")(
  function* (
    release: Docs["contentReleases"],
    role: ReleaseRole,
    releaseJson: string,
    rendererJson: string,
    signed: SignedContentRelease,
    state: Docs["contentState"]
  ) {
    if (
      release.role !== role ||
      release.releaseJson !== releaseJson ||
      release.rendererJson !== rendererJson
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Content release ${release.releaseId} already has different authenticated bytes.`
      );
    }
    const [derivedFamilies, storedFamilies] = yield* Effect.all([
      deriveReleaseFamilies(signed.manifest),
      loadReleaseFamilies(release),
    ]);
    if (
      !(
        hasExactFamilies(derivedFamilies.base, storedFamilies.base) &&
        hasExactFamilies(derivedFamilies.result, storedFamilies.result)
      )
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content release ${release.releaseId} changed ownership.`
      );
    }
    if (release.status === "completed") {
      if (
        state.activeReleaseId !== release.releaseId ||
        state.activeSequence !== release.sequence
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_STATE",
          `Completed release ${release.releaseId} is not the active sequence.`
        );
      }
      return;
    }
    const slotId =
      role === "candidate" ? state.candidateReleaseId : state.recoveryReleaseId;
    const slotSequence =
      role === "candidate" ? state.candidateSequence : state.recoverySequence;
    if (slotId !== release.releaseId || slotSequence !== release.sequence) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Content release ${release.releaseId} lost its ${role} slot.`
      );
    }
  }
);

/** Starts or idempotently resumes one candidate or recovery release. */
export const stageProgram = Effect.fn("contentRelease.stageRelease")(function* (
  role: ReleaseRole,
  releaseJson: string,
  rendererJson: string
) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const signed = yield* decodeReleaseJson(releaseJson);
  const renderer = yield* decodeRendererJson(rendererJson);
  const canonicalRelease = encodeReleaseJson(signed);
  const canonicalRenderer = encodeRendererJson(renderer);
  if (signed.manifest.rendererManifestHash !== renderer.hash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_UNSUPPORTED",
      `Content release ${signed.manifest.releaseId} does not bind its renderer.`
    );
  }
  const state = yield* ensureState();
  const existing = yield* database
    .table("contentReleases")
    .get("by_releaseId", signed.manifest.releaseId)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (existing) {
    yield* validateExisting(
      existing,
      role,
      canonicalRelease,
      canonicalRenderer,
      signed,
      state
    );
    return yield* releaseStatus(existing);
  }
  if (role === "candidate") {
    if (state.candidateReleaseId || state.recoveryReleaseId) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        "A candidate or retained recovery already owns publication state."
      );
    }
    yield* validateCandidateBase(signed.manifest, state);
  } else {
    if (state.recoveryReleaseId) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Recovery ${state.recoveryReleaseId} already owns publication state.`
      );
    }
    yield* validateRecoveryBase(signed.manifest, canonicalRenderer, state);
  }
  yield* validateExistingSnapshots(signed.manifest);
  const families = yield* deriveReleaseFamilies(signed.manifest);
  const now = yield* Clock.currentTimeMillis;
  const sequence = state.nextSequence;
  const row = {
    ...releaseReachability(signed),
    baseFamilies: families.base,
    checkedIndex: -1,
    checkedItems: 0,
    createdAt: now,
    releaseId: signed.manifest.releaseId,
    releaseJson: canonicalRelease,
    rendererJson: canonicalRenderer,
    resultFamilies: families.result,
    role,
    sequence,
    stagedArtifacts: 0,
    stagedDeletes: 0,
    stagedItems: 0,
    stagedProjections: 0,
    stagedRoutes: 0,
    stagedSnapshotBatches: 0,
    stagedSnapshotRows: 0,
    stagedUpserts: 0,
    status: "staging",
    tryoutRuntimeRequired: true,
    updatedAt: now,
  } satisfies WithoutSystemFields<Docs["contentReleases"]>;
  yield* ensureDocumentSize(`Content release ${row.releaseId}`, row);
  yield* writer.table("contentReleases").insert(row).pipe(Effect.orDie);
  const slot =
    role === "candidate"
      ? {
          candidateManifestHash: signed.manifestHash,
          candidateReleaseId: signed.manifest.releaseId,
          candidateSequence: sequence,
        }
      : {
          recoveryManifestHash: signed.manifestHash,
          recoveryReleaseId: signed.manifest.releaseId,
          recoverySequence: sequence,
        };
  yield* writer
    .table("contentState")
    .patch(state._id, {
      ...slot,
      nextSequence: sequence + 1,
      updatedAt: now,
    })
    .pipe(Effect.orDie);
  return {
    manifestHash: signed.manifestHash,
    phase: "staging",
    releaseId: signed.manifest.releaseId,
  } satisfies {
    readonly manifestHash: string;
    readonly phase: "staging";
    readonly releaseId: string;
  };
});
