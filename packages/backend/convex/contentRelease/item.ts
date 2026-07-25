import type { ContentReleaseItem } from "@nakafa/aksara-contracts/release";
import type { ContentHead } from "@nakafa/aksara-contracts/release/head";
import {
  canonicalizeRollbackSnapshotEntry,
  RollbackSnapshotEntrySchema,
  type RollbackSnapshotState,
} from "@nakafa/aksara-contracts/release/rollback";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { resolveContentHead } from "@repo/backend/convex/contentRelease/catalog";
import { ensureDocumentSize } from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadIdentityItem,
  loadItem,
  loadVersion,
} from "@repo/backend/convex/contentRelease/model";
import { Effect } from "effect";

type PresentRollbackState = Exclude<
  RollbackSnapshotState,
  { readonly state: "absent" }
>;

/** Binds one discriminated content head to its exact rollback state. */
function presentRollback(head: ContentHead): PresentRollbackState {
  if (head.family === "article") {
    return { head, state: "article" };
  }
  if (head.family === "material") {
    return { head, state: "material" };
  }
  return { head, state: "question" };
}

/** Encodes one exact absent prior state for rollback replay. */
function absentRollback(
  item: ContentReleaseItem,
  priorSequence: number | undefined
) {
  const entry = RollbackSnapshotEntrySchema.make({
    index: item.index,
    releaseId: item.releaseId,
    snapshot: {
      contentKey: item.change.contentKey,
      family: item.change.family,
      locale: item.change.locale,
      state: "absent",
    },
  });
  return {
    priorSequence,
    rollbackJson: canonicalizeRollbackSnapshotEntry(entry),
  };
}

/** Captures signed rollback evidence from immutable prior versions. */
const rollbackEvidence = Effect.fn("contentRelease.rollbackEvidence")(
  function* (
    ctx: MutationCtx,
    item: ContentReleaseItem,
    sequence: number | undefined
  ) {
    if (sequence === undefined) {
      return absentRollback(item, undefined);
    }
    const prior = yield* loadVersion(
      ctx,
      item.change.contentKey,
      item.change.locale,
      sequence
    );
    if (!prior || prior.operation === "delete") {
      return absentRollback(item, prior?.sequence);
    }
    const head = yield* resolveContentHead(
      ctx,
      item.change.contentKey,
      item.change.locale,
      sequence
    );
    if (!head) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Prior content ${item.change.contentKey}/${item.change.locale} is not recoverable.`
      );
    }
    const entry = RollbackSnapshotEntrySchema.make({
      index: item.index,
      releaseId: item.releaseId,
      snapshot: presentRollback(head),
    });
    return {
      priorSequence: prior.sequence,
      rollbackJson: canonicalizeRollbackSnapshotEntry(entry),
    };
  }
);

/** Creates one permanent directory key without changing existing identity. */
const ensureContentKey = Effect.fn("contentRelease.ensureContentKey")(
  function* (ctx: MutationCtx, item: ContentReleaseItem, sequence: number) {
    const existing = yield* Effect.promise(() =>
      ctx.db
        .query("contentKeys")
        .withIndex("by_contentKey_and_locale", (query) =>
          query
            .eq("contentKey", item.change.contentKey)
            .eq("locale", item.change.locale)
        )
        .unique()
    );
    if (existing) {
      if (existing.family !== item.change.family) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Content key ${item.change.contentKey}/${item.change.locale} changed family.`
        );
      }
      return;
    }
    yield* Effect.promise(() =>
      ctx.db.insert("contentKeys", {
        contentKey: item.change.contentKey,
        createdSequence: sequence,
        family: item.change.family,
        locale: item.change.locale,
      })
    );
  }
);

/** Stages one item while retaining only immutable prior-version evidence. */
export const stageContentItem = Effect.fn("contentRelease.stageContentItem")(
  function* (
    ctx: MutationCtx,
    item: ContentReleaseItem,
    itemJson: string,
    batchIndex: number,
    batchHash: string,
    role: "candidate" | "recovery",
    sequence: number,
    priorSequence: number | undefined
  ) {
    const atIndex = yield* loadItem(ctx, item.releaseId, item.index);
    const atIdentity = yield* loadIdentityItem(
      ctx,
      item.releaseId,
      item.change.contentKey,
      item.change.locale
    );
    if (atIndex || atIdentity) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Release item ${item.index} conflicts with previously staged identity.`
      );
    }
    const prior =
      priorSequence === undefined
        ? null
        : yield* loadVersion(
            ctx,
            item.change.contentKey,
            item.change.locale,
            priorSequence
          );
    if (
      item.change.operation === "delete" &&
      (!prior || prior.operation === "delete")
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        `Delete ${item.change.contentKey}/${item.change.locale} has no published head.`
      );
    }
    yield* ensureContentKey(ctx, item, sequence);
    const rollback = yield* rollbackEvidence(ctx, item, priorSequence);
    const row = {
      artifactHash:
        item.change.operation === "upsert"
          ? item.change.artifactHash
          : undefined,
      artifactReady: false,
      contentKey: item.change.contentKey,
      index: item.index,
      itemBatchHash: batchHash,
      itemBatchIndex: batchIndex,
      itemJson,
      locale: item.change.locale,
      priorSequence: rollback.priorSequence,
      projectionReady: false,
      releaseId: item.releaseId,
      rollbackJson: rollback.rollbackJson,
      sequence,
      stagedAt: Date.now(),
    };
    yield* ensureDocumentSize(`${role} release item ${item.index}`, row);
    yield* Effect.promise(() => ctx.db.insert("contentItems", row));
  }
);
