import { Table } from "@confect/core";
import { editorStepValidator } from "@repo/backend/confect/editor/schema";

/**
 * The steps of each document in version order. A read after a version is one
 * range of this index, and the sweep reads the rows in creation order.
 */
export default Table.make(() => editorStepValidator).index(
  "by_documentId_and_version",
  ["documentId", "version"]
);
