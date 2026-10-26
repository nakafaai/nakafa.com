import { Table } from "@confect/core";
import { examAssetValidator } from "@repo/backend/confect/exams/asset";

/**
 * The images of the exams, each stored once in Convex storage and named by its row's ID, which
 * a prompt refers to. A reader names the images of a prompt by ID, and each row is read by that
 * ID. The deletion of an exam finds its images by their exam (`by_examId`).
 */
export default Table.make(() => examAssetValidator).index("by_examId", [
  "examId",
]);
