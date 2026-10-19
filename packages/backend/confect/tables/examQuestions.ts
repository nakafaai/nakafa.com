import { Table } from "@confect/core";
import { questionValidator } from "@repo/backend/confect/exams/question";

/**
 * The questions of the exams. An exam reads its questions by their IDs in its own
 * order array. A prompt document finds the question it belongs to by `by_prompt`, so
 * an editor's step on a prompt can see whether its exam is frozen (ADR 0031).
 */
export default Table.make(() => questionValidator).index("by_prompt", [
  "prompt",
]);
