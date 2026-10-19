import { Table } from "@confect/core";
import { examAssetValidator } from "@repo/backend/confect/exams/asset";

/**
 * The images of the exams, each stored once in Convex storage and named by its row's ID, which
 * a prompt refers to. A reader names the images of a prompt by ID, and each row is read by that
 * ID, so the table needs no index.
 */
export default Table.make(() => examAssetValidator);
