import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { Document } from "@repo/backend/confect/editor/access";
import {
  authorizeScope,
  documentAccess,
} from "@repo/backend/confect/editor/authority";
import {
  ensureRowSize,
  storedDocument,
} from "@repo/backend/confect/editor/document";
import spec from "@repo/backend/confect/editor/documents.spec";
import {
  clientRecordOf,
  snapshotOf,
  stepsAfter,
} from "@repo/backend/confect/editor/store";
import { clientView, stepView } from "@repo/backend/confect/editor/view";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Array as Arr, Clock, Effect, Layer, Option } from "effect";

/**
 * Creates a document at head 0, with its snapshot at version 0. The scope is
 * decided first, then the content is read with the contract's Schema and checked
 * against the bounds, and only then are the rows written. A refused document
 * writes nothing, because the transaction rolls back.
 */
const create = FunctionImpl.make(
  databaseSchema,
  spec,
  "create",
  Effect.fn("editor.documents.create")(function* ({ content, scope }) {
    const { tenant } = yield* Member;
    yield* authorizeScope(scope);
    const text = yield* storedDocument(content);
    const at = yield* Clock.currentTimeMillis;
    const writer = yield* DatabaseWriter;
    const documentId = yield* writer
      .table("editorDocuments")
      .insert({
        createdAt: at,
        head: 0,
        scope,
        snapshotVersion: 0,
        tenantId: tenant._id,
      })
      .pipe(Effect.orDie);
    const snapshot = { at, content: text, documentId, version: 0 };
    yield* ensureRowSize(snapshot);
    yield* writer.table("editorSnapshots").insert(snapshot).pipe(Effect.orDie);
    return { id: documentId };
  })
);

/**
 * Reads a document for its editor: its head, its snapshot, the steps after the
 * snapshot, one read's worth, and the editor session's own record. The editor reads
 * on with `steps:since` from the last version it received, so a long document takes
 * more than one read. The record answers only the session's own author.
 */
const open = FunctionImpl.make(
  databaseSchema,
  spec,
  "open",
  Effect.fn("editor.documents.open")(function* ({ clientId }) {
    const document = yield* Document;
    const { appUser } = yield* requireAuth().pipe(Effect.orDie);
    const snapshot = yield* snapshotOf(document._id);
    const steps = yield* stepsAfter(document._id, snapshot.version);
    const record = yield* clientRecordOf(document._id, clientId);
    return {
      client: clientView(
        Option.filter(record, (own) => own.author === appUser._id)
      ),
      head: document.head,
      snapshot: { content: snapshot.content, version: snapshot.version },
      steps: Arr.map(steps, stepView),
    };
  })
);

/**
 * Implements the documents group of `documents.spec.ts`: create and open. The
 * document access check provides the document to `open`.
 */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(create),
  Layer.provide(open),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(documentAccess),
  GroupImpl.finalize
);
