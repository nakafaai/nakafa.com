import {
  hasSameContentSnapshots,
  invertContentSnapshots,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { loadRelease } from "@repo/backend/confect/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/confect/contentRelease/parse";
import { completedReceipt } from "@repo/backend/confect/contentRelease/receipt";
import { findReleaseTryoutRuntime } from "@repo/backend/confect/contentRelease/tryout/binding";
import { Effect } from "effect";

/** Exact stored recovery result returned to the authenticated Node verifier. */

/** Proves one recovery manifest is the exact inverse of its candidate. */
export const validateRecoveryRelation = Effect.fn(
  "contentRelease.validateRecoveryRelation"
)(function* (
  candidate: Docs["contentReleases"],
  recovery: Docs["contentReleases"]
) {
  const candidateSigned = yield* decodeReleaseJson(candidate.releaseJson);
  const recoverySigned = yield* decodeReleaseJson(recovery.releaseJson);
  if (
    candidate.role !== "candidate" ||
    candidate.status !== "completed" ||
    recovery.role !== "recovery" ||
    recoverySigned.manifest.origin.kind !== "rollback" ||
    recoverySigned.manifest.origin.releaseId !== candidate.releaseId ||
    recoverySigned.manifest.baseReleaseId !== candidate.releaseId ||
    recoverySigned.manifest.baseManifestHash !== candidateSigned.manifestHash ||
    recoverySigned.manifest.baseResultCount !==
      candidateSigned.manifest.resultCount ||
    recoverySigned.manifest.baseResultDigest !==
      candidateSigned.manifest.resultDigest ||
    recoverySigned.manifest.resultCount !==
      candidateSigned.manifest.baseResultCount ||
    recoverySigned.manifest.resultDigest !==
      candidateSigned.manifest.baseResultDigest ||
    !hasSameContentSnapshots(
      recoverySigned.manifest.snapshots,
      invertContentSnapshots(candidateSigned.manifest.snapshots)
    )
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Recovery ${recovery.releaseId} is not the exact inverse of candidate ${candidate.releaseId}.`
    );
  }
  yield* completedReceipt(candidate, candidateSigned);
  return {
    candidate: candidateSigned,
    recovery: recoverySigned,
  };
});

/** Looks up exact historical recovery completion for crash-safe replay. */
export const lookupProgram = Effect.fn("contentRelease.recoveryLookup")(
  function* (releaseId: string, recoveryId: string) {
    const database = yield* DatabaseReader;
    const recovery = yield* database
      .table("contentReleases")
      .get("by_releaseId", recoveryId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (recovery?.status !== "completed") {
      return {
        kind: "missing",
      } satisfies {
        readonly kind: "missing";
      };
    }
    const candidate = yield* loadRelease(releaseId);
    const signed = yield* validateRecoveryRelation(candidate, recovery);
    yield* findReleaseTryoutRuntime(
      signed.recovery,
      recovery.tryoutRuntimeBundleHash
    );
    return {
      kind: "completed",
      value: {
        receipt: yield* completedReceipt(recovery, signed.recovery),
        releaseJson: recovery.releaseJson,
        rendererJson: recovery.rendererJson,
      },
    } satisfies {
      readonly kind: "completed";
      readonly value: {
        readonly receipt: unknown;
        readonly releaseJson: string;
        readonly rendererJson: string;
      };
    };
  }
);
