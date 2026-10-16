import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { Document } from "@repo/backend/confect/editor/access";
import { documentAccess } from "@repo/backend/confect/editor/authority";
import {
  ensureRowSize,
  storedDocument,
} from "@repo/backend/confect/editor/document";
import { SnapshotRefused } from "@repo/backend/confect/editor/errors";
import { snapshotDue } from "@repo/backend/confect/editor/snapshot";
import spec from "@repo/backend/confect/editor/snapshots.spec";
import { lastStepOf, snapshotOf } from "@repo/backend/confect/editor/store";
import member from "@repo/backend/confect/middleware/member.impl";
import session from "@repo/backend/confect/middleware/session.impl";
import { Clock, DateTime, Effect, Layer, Option } from "effect";

/**
 * Saves the document at a version the client has confirmed. The version must be
 * newer than the stored snapshot and no newer than the head. The snapshot rule
 * must allow a snapshot now, the content must pass the contract's Schema, and the
 * complete row must stay under one document's limit. Any refusal writes nothing.
 * An accepted snapshot replaces the stored one, and it moves the document's snapshot
 * version in the same transaction, so the sweep reads the version and never the row.
 */
const save = FunctionImpl.make(
  databaseSchema,
  spec,
  "save",
  Effect.fn("editor.snapshots.save")(function* ({ content, version }) {
    const document = yield* Document;
    const stored = yield* snapshotOf(document._id);
    if (version <= stored.version) {
      return yield* new SnapshotRefused({ reason: "stale" });
    }
    if (version > document.head) {
      return yield* new SnapshotRefused({ reason: "ahead" });
    }
    const lastStep = yield* lastStepOf(document._id);
    const now = yield* Clock.currentTimeMillis;
    const due = snapshotDue({
      lastSnapshotAt: Option.some(DateTime.makeUnsafe(stored.at)),
      lastStepAt: DateTime.makeUnsafe(lastStep._creationTime),
      now: DateTime.makeUnsafe(now),
      stepsSince: document.head - stored.version,
    });
    if (!due) {
      return yield* new SnapshotRefused({ reason: "notDue" });
    }
    const text = yield* storedDocument(content);
    const snapshot = {
      at: now,
      content: text,
      documentId: document._id,
      version,
    };
    yield* ensureRowSize(snapshot);
    const writer = yield* DatabaseWriter;
    yield* writer
      .table("editorSnapshots")
      .replace(stored._id, snapshot)
      .pipe(Effect.orDie);
    yield* writer
      .table("editorDocuments")
      .patch(document._id, { snapshotVersion: version })
      .pipe(Effect.orDie);
    return { version };
  })
);

/** Implements the snapshots group of `snapshots.spec.ts`: the save of a snapshot. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(save),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(documentAccess),
  GroupImpl.finalize
);
