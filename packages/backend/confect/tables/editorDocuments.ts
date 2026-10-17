import { Table } from "@confect/core";
import { editorDocumentValidator } from "@repo/backend/confect/editor/schema";

/**
 * The collaborative documents. Every read takes one by its ID, so the table has no
 * index of its own.
 */
export default Table.make(() => editorDocumentValidator);
