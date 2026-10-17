import { Table } from "@confect/core";
import { editorSnapshotValidator } from "@repo/backend/confect/editor/schema";

/** The snapshot of each document, read by its document to open it and to decide a new one. */
export default Table.make(() => editorSnapshotValidator).index(
  "by_documentId",
  ["documentId"]
);
