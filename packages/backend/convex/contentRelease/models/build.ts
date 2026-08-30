import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadRelease,
  loadState,
  ownsRole,
} from "@repo/backend/convex/contentRelease/model";
import { getReadModelImpact } from "@repo/backend/convex/contentRelease/models/impact";
import { firstModelPhase } from "@repo/backend/convex/contentRelease/models/phase";
import {
  alternateModelSlot,
  type ModelSlots,
  selectModelSlots,
} from "@repo/backend/convex/contentRelease/models/slot";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import { makeFunctionReference } from "convex/server";
import { Clock, Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;
type Release = Doc<"contentReleases">;
type State = Doc<"contentState">;

const resumeReference = makeFunctionReference<
  "mutation",
  { generation: number; releaseId: string },
  null
>("contentRelease/models:resume");

/** Loads the sole candidate model build when one exists. */
export function loadModelBuild(ctx: ReadCtx) {
  return Effect.promise(() =>
    ctx.db
      .query("contentModelBuilds")
      .withIndex("by_key", (index) => index.eq("key", "primary"))
      .unique()
  );
}

/** Derives the exact active identity captured before candidate preparation. */
function getModelBase(state: State, signed: SignedContentRelease) {
  if (
    signed.manifest.baseReleaseId === null &&
    signed.manifest.baseManifestHash === null &&
    state.activeReleaseId === undefined &&
    state.activeManifestHash === undefined &&
    state.activeSequence === undefined
  ) {
    return { kind: "empty" as const };
  }
  if (
    signed.manifest.baseReleaseId &&
    signed.manifest.baseManifestHash &&
    state.activeReleaseId === signed.manifest.baseReleaseId &&
    state.activeManifestHash === signed.manifest.baseManifestHash &&
    state.activeSequence !== undefined
  ) {
    return {
      kind: "release" as const,
      manifestHash: state.activeManifestHash,
      releaseId: state.activeReleaseId,
      sequence: state.activeSequence,
    };
  }
  return null;
}

/** Proves a repeated prepare call names the same candidate and base buffers. */
function hasExactBuild(
  build: Doc<"contentModelBuilds">,
  release: Release,
  signed: SignedContentRelease,
  base: ReturnType<typeof getModelBase>,
  slots: ModelSlots
) {
  if (!base) {
    return false;
  }
  const impact = getReadModelImpact(signed.manifest.scope);
  const sameBase =
    base.kind === "empty"
      ? build.base.kind === "empty"
      : build.base.kind === "release" &&
        build.base.manifestHash === base.manifestHash &&
        build.base.releaseId === base.releaseId &&
        build.base.sequence === base.sequence;
  return (
    sameBase &&
    build.releaseId === release.releaseId &&
    build.manifestHash === signed.manifestHash &&
    build.sequence === release.sequence &&
    build.slots.articleBaseSlot === slots.articleSlot &&
    build.slots.articleTargetSlot ===
      (impact.article
        ? alternateModelSlot(slots.articleSlot)
        : slots.articleSlot) &&
    build.slots.materialBaseSlot === slots.materialSlot &&
    build.slots.materialTargetSlot ===
      (impact.material
        ? alternateModelSlot(slots.materialSlot)
        : slots.materialSlot) &&
    build.slots.searchBaseSlot === slots.searchSlot &&
    build.slots.searchTargetSlot ===
      (impact.search ? alternateModelSlot(slots.searchSlot) : slots.searchSlot)
  );
}

/** Loads and validates the exact invisible candidate owned by one model build. */
export const loadModelBuildRelease = Effect.fn(
  "contentRelease.loadModelBuildRelease"
)(function* (ctx: ReadCtx, build: Doc<"contentModelBuilds">) {
  const [release, state] = yield* Effect.all([
    loadRelease(ctx, build.releaseId),
    loadState(ctx),
  ]);
  if (
    !state ||
    release.status !== "verified" ||
    release.sequence !== build.sequence ||
    !ownsRole(state, release.role, release) ||
    (release.role === "candidate"
      ? state.candidateManifestHash !== build.manifestHash
      : state.recoveryManifestHash !== build.manifestHash)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Content release ${build.releaseId} no longer owns its model build.`
    );
  }
  const signed = yield* decodeReleaseJson(release.releaseJson);
  const base = getModelBase(state, signed);
  const slots = selectModelSlots(state);
  if (!hasExactBuild(build, release, signed, base, slots)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STALE_BASE",
      `Content release ${build.releaseId} model build lost its exact base.`
    );
  }
  return { release, signed, state };
});

/** Starts or resumes the sole inactive-buffer build for one candidate. */
export const ensureModelBuild = Effect.fn("contentRelease.ensureModelBuild")(
  function* (
    ctx: MutationCtx,
    release: Release,
    signed: SignedContentRelease,
    state: State
  ) {
    const base = getModelBase(state, signed);
    if (!base) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STALE_BASE",
        `Content release ${release.releaseId} no longer extends the active release.`
      );
    }
    const slots = selectModelSlots(state);
    const existing = yield* loadModelBuild(ctx);
    if (existing) {
      if (hasExactBuild(existing, release, signed, base, slots)) {
        return existing;
      }
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Content release ${release.releaseId} conflicts with model build ${existing.releaseId}.`
      );
    }

    const impact = getReadModelImpact(signed.manifest.scope);
    const buildSlots = {
      articleBaseSlot: slots.articleSlot,
      articleTargetSlot: impact.article
        ? alternateModelSlot(slots.articleSlot)
        : slots.articleSlot,
      materialBaseSlot: slots.materialSlot,
      materialTargetSlot: impact.material
        ? alternateModelSlot(slots.materialSlot)
        : slots.materialSlot,
      searchBaseSlot: slots.searchSlot,
      searchTargetSlot: impact.search
        ? alternateModelSlot(slots.searchSlot)
        : slots.searchSlot,
    };
    const phase = firstModelPhase({ slots: buildSlots });
    const generation = 1;
    const syncJobId =
      phase === "ready"
        ? undefined
        : yield* Effect.promise(() =>
            ctx.scheduler.runAfter(0, resumeReference, {
              generation,
              releaseId: release.releaseId,
            })
          );
    const updatedAt = yield* Clock.currentTimeMillis;
    const id = yield* Effect.promise(() =>
      ctx.db.insert("contentModelBuilds", {
        base,
        generation,
        itemIndex: -1,
        key: "primary",
        manifestHash: signed.manifestHash,
        phase,
        releaseId: release.releaseId,
        sequence: release.sequence,
        slots: buildSlots,
        ...(syncJobId === undefined ? {} : { syncJobId }),
        updatedAt,
      })
    );
    const created = yield* Effect.promise(() =>
      ctx.db.get("contentModelBuilds", id)
    );
    if (!created) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Content release ${release.releaseId} did not create its model build.`
      );
    }
    return created;
  }
);

/** Removes only the model build owned by one exact candidate. */
export const deleteModelBuild = Effect.fn("contentRelease.deleteModelBuild")(
  function* (ctx: MutationCtx, releaseId: string) {
    const build = yield* loadModelBuild(ctx);
    if (build?.releaseId === releaseId) {
      yield* Effect.promise(() =>
        ctx.db.delete("contentModelBuilds", build._id)
      );
    }
  }
);
