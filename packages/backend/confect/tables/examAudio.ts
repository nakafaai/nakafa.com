import { Table } from "@confect/core";
import { examAudioValidator } from "@repo/backend/confect/exams/media";

/**
 * The audio clips of the exams, each stored once in Convex storage and named by its row's ID, which a question
 * refers to. The deletion of an exam finds its clips by their exam (`by_examId`).
 */
export default Table.make(() => examAudioValidator).index("by_examId", [
  "examId",
]);
