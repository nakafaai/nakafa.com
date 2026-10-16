import { Id } from "@repo/backend/confect/_generated/id";
import { GrantScope } from "@repo/backend/confect/access/schema";
import { VersionSchema } from "@repo/backend/confect/editor/batch";
import { StoredStepSchema } from "@repo/backend/confect/editor/log";
import { Schema, Struct } from "effect";

/**
 * One collaborative document: its tenant, the scope that decides who may read and
 * edit it (the tenant or one unit), its head, and when it was made. `head` is the
 * version, the number of steps accepted so far, so a submit reads one small row.
 */
export const editorDocumentValidator = Schema.Struct({
  createdAt: Schema.Finite,
  head: VersionSchema,
  scope: GrantScope,
  tenantId: Id("tenants"),
});

/**
 * The document at one version, as JSON text. Each document holds one snapshot row,
 * which a newer snapshot replaces. `at` is the time the snapshot was written.
 */
export const editorSnapshotValidator = Schema.Struct({
  at: Schema.Finite,
  content: Schema.String,
  documentId: Id("editorDocuments"),
  version: VersionSchema,
});

/**
 * One stored step: the stored step of `log.ts` (its author, its client, and its
 * step as JSON text), with the document it belongs to and the version it produces.
 * The row keeps the step as text, so reading a row does not parse the step.
 */
export const editorStepValidator = StoredStepSchema.mapFields(
  Struct.assign({
    documentId: Id("editorDocuments"),
    step: Schema.String,
    version: VersionSchema,
  })
);
