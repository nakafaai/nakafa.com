import { Table } from "@confect/core";
import { examSittingValidator } from "@repo/backend/confect/exams/sittings/schema";

/**
 * The proctored sittings of school exams. A sitting is read by its ID, so the
 * table has no index yet (ADR 0013).
 */
export default Table.make(() => examSittingValidator);
