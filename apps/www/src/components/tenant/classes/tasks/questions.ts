import { Id } from "@repo/backend/confect/_generated/id";
import { Option, Schema } from "effect";

/** The value of the question picker's first choice: a task the students answer in writing. */
export const WRITTEN = "written";

const decodeExamId = Schema.decodeUnknownOption(Id("exams"));

/**
 * The exam a task's question picker names, as the publish takes it: none for a written answer, and
 * otherwise the chosen exam. An exam ID is any string to its schema, so the written choice is matched
 * by its own value first and never reaches the server as an ID.
 */
export const examOfChoice = (choice: string) =>
  choice === WRITTEN ? null : Option.getOrNull(decodeExamId(choice));
