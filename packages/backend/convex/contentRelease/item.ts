import type { ContentReleaseItem } from "@nakafa/aksara-contracts/release";
import type { ContentHead } from "@nakafa/aksara-contracts/release/head";
import {
  canonicalizeRollbackSnapshotEntry,
  RollbackSnapshotEntrySchema,
  type RollbackSnapshotState,
} from "@nakafa/aksara-contracts/release/rollback/spec";
import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import { contentHead } from "@repo/backend/content/publication/projection";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
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
  if (head.family === "page") {
    return { head, state: "page" };
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
      artifactLocale: item.change.artifactLocale,
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
    prior: Doc<"contentHeads"> | null,
    sequence: number | undefined
  ) {
    if (sequence === undefined) {
      return absentRollback(item, undefined);
    }
    if (!prior || prior.operation === "delete") {
      return absentRollback(item, prior?.sequence);
    }
    const head = yield* contentHead(prior, sequence).pipe(
      Effect.provide(convexPublicationLayer(ctx))
    );
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
        .withIndex("by_contentKey_and_artifactLocale", (query) =>
          query
            .eq("contentKey", item.change.contentKey)
            .eq("artifactLocale", item.change.artifactLocale)
        )
        .unique()
    );
    if (existing) {
      if (existing.family !== item.change.family) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Content key ${item.change.contentKey}/${item.change.artifactLocale} changed family.`
        );
      }
      return;
    }
    yield* Effect.promise(() =>
      ctx.db.insert("contentKeys", {
        artifactLocale: item.change.artifactLocale,
        contentKey: item.change.contentKey,
        createdSequence: sequence,
        family: item.change.family,
      })
    );
  }
);

/** Stages one item while retaining only immutable prior-version evidence. */
export const stageContentItem = Effect.fn("contentRelease.stageContentItem")(
  function* (
    ctx: MutationCtx,
    input: {
      readonly batchHash: string;
      readonly batchIndex: number;
      readonly item: ContentReleaseItem;
      readonly itemJson: string;
      readonly priorSequence: number | undefined;
      readonly role: "candidate" | "recovery";
      readonly sequence: number;
    }
  ) {
    const {
      batchHash,
      batchIndex,
      item,
      itemJson,
      priorSequence,
      role,
      sequence,
    } = input;
    const atIndex = yield* loadItem(ctx, item.releaseId, item.index);
    const atIdentity = yield* loadIdentityItem(
      ctx,
      item.releaseId,
      item.change.contentKey,
      item.change.artifactLocale
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
            item.change.artifactLocale,
            priorSequence
          );
    if (
      item.change.operation === "delete" &&
      (!prior || prior.operation === "delete")
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        `Delete ${item.change.contentKey}/${item.change.artifactLocale} has no published head.`
      );
    }
    yield* ensureContentKey(ctx, item, sequence);
    const rollback = yield* rollbackEvidence(ctx, item, prior, priorSequence);
    const row = {
      artifactHash:
        item.change.operation === "upsert"
          ? item.change.artifactHash
          : undefined,
      artifactLocale: item.change.artifactLocale,
      artifactReady: false,
      contentKey: item.change.contentKey,
      index: item.index,
      itemBatchHash: batchHash,
      itemBatchIndex: batchIndex,
      itemJson,
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
