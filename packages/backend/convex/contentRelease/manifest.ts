import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { abortProgram } from "@repo/backend/convex/contentRelease/abort";
import {
  validateCandidateBase,
  validateExistingSnapshots,
  validateRecoveryBase,
} from "@repo/backend/convex/contentRelease/base";
import { ensureDocumentSize } from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { ensureState } from "@repo/backend/convex/contentRelease/model";
import {
  decodeReleaseJson,
  decodeRendererJson,
} from "@repo/backend/convex/contentRelease/parse";
import { completedReceipt } from "@repo/backend/convex/contentRelease/receipt";
import { hasRendererIdentity } from "@repo/backend/convex/contentRelease/renderer";
import {
  abortReceiptValidator,
  statusValidator,
} from "@repo/backend/convex/contentRelease/spec";
import {
  encodeReleaseJson,
  encodeRendererJson,
} from "@repo/backend/convex/contentRelease/wire";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type { WithoutSystemFields } from "convex/server";
import { type Infer, v } from "convex/values";
import { Effect } from "effect";

type ReleaseRole = Doc<"contentReleases">["role"];
type ReleaseStatus = Infer<typeof statusValidator>;

/** Projects one durable release into its exact shared lifecycle status. */
const releaseStatus = Effect.fn("contentRelease.releaseStatus")(function* (
  release: Doc<"contentReleases">
) {
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
});

/** Confirms an idempotent release still owns the same immutable role slot. */
const validateExisting = Effect.fn("contentRelease.validateExisting")(
  function* (
    release: Doc<"contentReleases">,
    role: ReleaseRole,
    releaseJson: string,
    rendererJson: string,
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
const stageProgram = Effect.fn("contentRelease.stageRelease")(function* (
  ctx: MutationCtx,
  role: ReleaseRole,
  releaseJson: string,
  rendererJson: string
) {
  const signed = yield* decodeReleaseJson(releaseJson);
  const renderer = yield* decodeRendererJson(rendererJson);
  const canonicalRelease = encodeReleaseJson(signed);
  const canonicalRenderer = encodeRendererJson(renderer);
  if (!hasRendererIdentity(signed.manifest, renderer)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_UNSUPPORTED",
      `Content release ${signed.manifest.releaseId} does not bind its renderer.`
    );
  }
  const state = yield* ensureState(ctx);
  const existing = yield* Effect.promise(() =>
    ctx.db
      .query("contentReleases")
      .withIndex("by_releaseId", (query) =>
        query.eq("releaseId", signed.manifest.releaseId)
      )
      .unique()
  );
  if (existing) {
    yield* validateExisting(
      existing,
      role,
      canonicalRelease,
      canonicalRenderer,
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
  const now = Date.now();
  const sequence = state.nextSequence;
  const row = {
    checkedIndex: -1,
    checkedItems: 0,
    createdAt: now,
    releaseId: signed.manifest.releaseId,
    releaseJson: canonicalRelease,
    rendererJson: canonicalRenderer,
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
    updatedAt: now,
  } satisfies WithoutSystemFields<Doc<"contentReleases">>;
  yield* ensureDocumentSize(`Content release ${row.releaseId}`, row);
  yield* Effect.promise(() => ctx.db.insert("contentReleases", row));
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
  yield* Effect.promise(() =>
    ctx.db.patch("contentState", state._id, {
      ...slot,
      nextSequence: sequence + 1,
      updatedAt: now,
    })
  );
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

/** Stores a decoded candidate and its trusted renderer snapshot. */
export const stageRelease = internalMutation({
  args: { releaseJson: v.string(), rendererJson: v.string() },
  returns: statusValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      stageProgram(ctx, "candidate", args.releaseJson, args.rendererJson)
    ),
});

/** Stores the verified candidate's pre-staged inverse release. */
export const stageRecovery = internalMutation({
  args: { releaseJson: v.string(), rendererJson: v.string() },
  returns: statusValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      stageProgram(ctx, "recovery", args.releaseJson, args.rendererJson)
    ),
});

/** Clears bounded invisible state before marking a release aborted. */
export const abort = internalMutation({
  args: { releaseId: v.string() },
  returns: abortReceiptValidator,
  handler: (ctx, args) => runConvexProgram(abortProgram(ctx, args.releaseId)),
});
