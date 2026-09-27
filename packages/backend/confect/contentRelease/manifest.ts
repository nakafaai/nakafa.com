import { DatabaseReader, DatabaseWriter } from "@confect/server";
import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import databaseSchema from "@repo/backend/confect/_generated/schema";
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
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { WithoutSystemFields } from "convex/server";
import { Clock, Effect, type Schema } from "effect";
export type ReleaseRole = Doc<"contentReleases">["role"];
export type ReleaseStatus = Schema.Schema.Type<typeof statusValidator>;

/** Projects one durable release into its exact shared lifecycle status. */
export const releaseStatus = Effect.fn("contentRelease.releaseStatus")(
  function* (release: Doc<"contentReleases">) {
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
    ctx: MutationCtx,
    release: Doc<"contentReleases">,
    role: ReleaseRole,
    releaseJson: string,
    rendererJson: string,
    signed: SignedContentRelease,
    state: Doc<"contentState">
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
      deriveReleaseFamilies(ctx, signed.manifest),
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
  ctx: MutationCtx,
  role: ReleaseRole,
  releaseJson: string,
  rendererJson: string
) {
  const database = DatabaseReader.make(databaseSchema, ctx.db);
  const writer = DatabaseWriter.make(databaseSchema, ctx.db);
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
  const state = yield* ensureState(ctx);
  const existing = yield* database
    .table("contentReleases")
    .get("by_releaseId", signed.manifest.releaseId)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (existing) {
    yield* validateExisting(
      ctx,
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
    yield* validateCandidateBase(ctx, signed.manifest, state);
  } else {
    if (state.recoveryReleaseId) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Recovery ${state.recoveryReleaseId} already owns publication state.`
      );
    }
    yield* validateRecoveryBase(ctx, signed.manifest, canonicalRenderer, state);
  }
  yield* validateExistingSnapshots(ctx, signed.manifest);
  const families = yield* deriveReleaseFamilies(ctx, signed.manifest);
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
  } satisfies WithoutSystemFields<Doc<"contentReleases">>;
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
