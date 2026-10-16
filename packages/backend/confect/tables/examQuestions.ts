import { Table } from "@confect/core";
import { questionValidator } from "@repo/backend/confect/exams/question";

/**
 * The questions of the exams. An exam reads its questions by their IDs in its own
 * order array, so the table has no index of its own.
 */
export default Table.make(() => questionValidator);
