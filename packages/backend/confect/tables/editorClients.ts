import { Table } from "@confect/core";
import { editorClientValidator } from "@repo/backend/confect/editor/schema";

/**
 * The editor sessions of each document, one row per session. A submit reads its
 * session's row by the document and the client id, and the sweep reads the rows in
 * creation order.
 */
export default Table.make(() => editorClientValidator).index(
  "by_documentId_and_clientId",
  ["documentId", "clientId"]
);
