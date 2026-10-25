import { Table } from "@confect/core";
import { questionValidator } from "@repo/backend/confect/exams/question";

/**
 * The questions of the exams. An exam reads its questions by their IDs in its own
 * order array. Each document a question owns finds that question by its own index, so
 * an editor's step on a prompt, a rubric, or an explanation can see whether its exam is
 * frozen (ADR 0031).
 */
export default Table.make(() => questionValidator)
  .index("by_prompt", ["prompt"])
  .index("by_rubric", ["rubric"])
  .index("by_explanation", ["explanation"]);
