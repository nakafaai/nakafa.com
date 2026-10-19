import { Table } from "@confect/core";
import { examAssetValidator } from "@repo/backend/confect/exams/asset";

/**
 * The images of the exams, each stored once in Convex storage and named by its row's ID, which
 * a prompt refers to. An exam reads its images through the one index, so a deleted exam takes
 * its images with it.
 */
export default Table.make(() => examAssetValidator).index("by_examId", [
  "examId",
]);
