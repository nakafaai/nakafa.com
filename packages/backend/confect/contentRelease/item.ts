import type { ContentReleaseItem } from "@nakafa/aksara-contracts/release";
import type { ContentHead } from "@nakafa/aksara-contracts/release/head";
import {
  canonicalizeRollbackSnapshotEntry,
  type RollbackArticleStateSchema,
  type RollbackMaterialStateSchema,
  type RollbackPageStateSchema,
  type RollbackQuestionStateSchema,
  RollbackSnapshotEntrySchema,
} from "@nakafa/aksara-contracts/release/rollback/spec";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { ensureDocumentSize } from "@repo/backend/confect/contentRelease/document";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  loadIdentityItem,
  loadItem,
  loadVersion,
} from "@repo/backend/confect/contentRelease/model";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import { contentHead } from "@repo/backend/content/publication/projection";
import { Clock, Effect } from "effect";

type PresentRollbackState =
  | typeof RollbackArticleStateSchema.Type
  | typeof RollbackMaterialStateSchema.Type
  | typeof RollbackPageStateSchema.Type
  | typeof RollbackQuestionStateSchema.Type;

/** Binds one discriminated content head to its exact rollback state. */
function presentRollback(head: ContentHead): PresentRollbackState {
  if (head.family === "article") {
    return {
      head,
      state: "article",
    };
  }
  if (head.family === "material") {
    return {
      head,
      state: "material",
    };
  }
  if (head.family === "page") {
    return {
      head,
      state: "page",
    };
  }
  return {
    head,
    state: "question",
  };
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
    item: ContentReleaseItem,
    prior: Docs["contentHeads"] | null,
    sequence: number | undefined
  ) {
    if (sequence === undefined) {
      return absentRollback(item, undefined);
    }
    if (!prior || prior.operation === "delete") {
      return absentRollback(item, prior?.sequence);
    }
    const head = yield* contentHead(prior, sequence).pipe(
      Effect.provide(publicationLayer)
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
  function* (item: ContentReleaseItem, sequence: number) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const existing = yield* database
      .table("contentKeys")
      .get(
        "by_contentKey_and_artifactLocale",
        item.change.contentKey,
        item.change.artifactLocale
      )
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
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
    yield* writer
      .table("contentKeys")
      .insert({
        artifactLocale: item.change.artifactLocale,
        contentKey: item.change.contentKey,
        createdSequence: sequence,
        family: item.change.family,
      })
      .pipe(Effect.orDie);
  }
);

/** Stages one item while retaining only immutable prior-version evidence. */
export const stageContentItem = Effect.fn("contentRelease.stageContentItem")(
  function* (input: {
    readonly batchHash: string;
    readonly batchIndex: number;
    readonly item: ContentReleaseItem;
    readonly itemJson: string;
    readonly priorSequence: number | undefined;
    readonly role: "candidate" | "recovery";
    readonly sequence: number;
  }) {
    const writer = yield* DatabaseWriter;
    const {
      batchHash,
      batchIndex,
      item,
      itemJson,
      priorSequence,
      role,
      sequence,
    } = input;
    const atIndex = yield* loadItem(item.releaseId, item.index);
    const atIdentity = yield* loadIdentityItem(
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
    yield* ensureContentKey(item, sequence);
    const rollback = yield* rollbackEvidence(item, prior, priorSequence);
    const row = {
      ...(item.change.operation === "upsert"
        ? {
            artifactHash: item.change.artifactHash,
          }
        : {}),
      artifactLocale: item.change.artifactLocale,
      artifactReady: false,
      contentKey: item.change.contentKey,
      index: item.index,
      itemBatchHash: batchHash,
      itemBatchIndex: batchIndex,
      itemJson,
      ...(rollback.priorSequence === undefined
        ? {}
        : {
            priorSequence: rollback.priorSequence,
          }),
      projectionReady: false,
      releaseId: item.releaseId,
      rollbackJson: rollback.rollbackJson,
      sequence,
      stagedAt: yield* Clock.currentTimeMillis,
    };
    yield* ensureDocumentSize(`${role} release item ${item.index}`, row);
    yield* writer.table("contentItems").insert(row).pipe(Effect.orDie);
  }
);
