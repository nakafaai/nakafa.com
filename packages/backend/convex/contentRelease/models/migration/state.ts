import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadState } from "@repo/backend/convex/contentRelease/model";
import {
  FIRST_MODEL_TABLE,
  type ModelMigrationCycle,
} from "@repo/backend/convex/contentRelease/models/migration/spec";
import { INITIAL_MODEL_SLOT } from "@repo/backend/convex/contentRelease/models/slot";
import { Effect } from "effect";

export interface StableModelState {
  readonly active: {
    readonly manifestHash: string;
    readonly releaseId: string;
    readonly sequence: number;
  };
  readonly state: Doc<"contentState">;
}

/** Requires one complete active identity with no concurrent publication. */
export const stableModelState = Effect.fn("contentRelease.modelMigrationState")(
  function* (ctx: MutationCtx | QueryCtx) {
    const state = yield* loadState(ctx);
    if (
      !(state?.activeManifestHash && state.activeReleaseId) ||
      state.activeSequence === undefined ||
      state.candidateManifestHash !== undefined ||
      state.candidateReleaseId !== undefined ||
      state.candidateSequence !== undefined ||
      state.recoveryManifestHash !== undefined ||
      state.recoveryReleaseId !== undefined ||
      state.recoverySequence !== undefined ||
      state.articleManifestHash !== state.activeManifestHash ||
      state.articleReleaseId !== state.activeReleaseId ||
      state.articleSequence !== state.activeSequence ||
      state.materialManifestHash !== state.activeManifestHash ||
      state.materialReleaseId !== state.activeReleaseId ||
      state.materialSequence !== state.activeSequence ||
      state.searchManifestHash !== state.activeManifestHash ||
      state.searchReleaseId !== state.activeReleaseId ||
      state.searchSequence !== state.activeSequence
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        "Read-model slot migration requires one fully converged active release with no candidate or recovery."
      );
    }
    return {
      active: {
        manifestHash: state.activeManifestHash,
        releaseId: state.activeReleaseId,
        sequence: state.activeSequence,
      },
      state,
    } satisfies StableModelState;
  }
);

/** Rejects active-state drift across every crash-safe migration page. */
export const validateModelMigrationState = Effect.fn(
  "contentRelease.validateModelMigrationState"
)(function* (stable: StableModelState, migration: ModelMigrationCycle) {
  if (
    stable.active.manifestHash !== migration.activeManifestHash ||
    stable.active.releaseId !== migration.activeReleaseId ||
    stable.active.sequence !== migration.activeSequence
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STALE_BASE",
      "Read-model slot migration lost its exact active release."
    );
  }
});

/** Loads the singleton migration cycle when one is already in progress. */
export function loadModelMigration(ctx: MutationCtx | QueryCtx) {
  return Effect.promise(() =>
    ctx.db
      .query("contentModelMigrations")
      .withIndex("by_key", (index) => index.eq("key", "primary"))
      .unique()
  );
}

/** Blocks legacy publication once the one-time slot transition begins. */
export const requirePreMigrationModels = Effect.fn(
  "contentRelease.requirePreMigrationModels"
)(function* (ctx: MutationCtx | QueryCtx) {
  const [migration, state] = yield* Effect.all([
    loadModelMigration(ctx),
    loadState(ctx),
  ]);
  if (
    migration ||
    state?.articleSlot !== undefined ||
    state?.materialSlot !== undefined ||
    state?.searchSlot !== undefined
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Content publication is paused while read-model slots transition to atomic switching."
    );
  }
});

/** Starts one exact migration cycle after proving the production baseline. */
export const ensureModelMigration = Effect.fn(
  "contentRelease.ensureModelMigration"
)(function* (ctx: MutationCtx, stable: StableModelState) {
  const existing = yield* loadModelMigration(ctx);
  if (existing) {
    yield* validateModelMigrationState(stable, existing);
    return existing;
  }
  const fields = {
    activeManifestHash: stable.active.manifestHash,
    activeReleaseId: stable.active.releaseId,
    activeSequence: stable.active.sequence,
    key: "primary" as const,
    phase: "backfill" as const,
    scannedRows: 0,
    table: FIRST_MODEL_TABLE,
    updatedAt: Date.now(),
  } satisfies Omit<ModelMigrationCycle, "_id">;
  const id = yield* Effect.promise(() =>
    ctx.db.insert("contentModelMigrations", fields)
  );
  return { _id: id, ...fields } satisfies ModelMigrationCycle;
});

/** Removes only a fully proven one-time migration receipt. */
export const acceptModelMigration = Effect.fn(
  "contentRelease.acceptModelMigration"
)(function* (ctx: MutationCtx) {
  const stable = yield* stableModelState(ctx);
  const migration = yield* loadModelMigration(ctx);
  const slots = [
    stable.state.articleSlot,
    stable.state.materialSlot,
    stable.state.searchSlot,
  ];
  if (
    migration?.phase !== "complete" ||
    slots.some((slot) => slot !== INITIAL_MODEL_SLOT)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Read-model slot migration is not ready for terminal acceptance."
    );
  }
  yield* validateModelMigrationState(stable, migration);
  yield* Effect.promise(() =>
    ctx.db.delete("contentModelMigrations", migration._id)
  );
  return null;
});
