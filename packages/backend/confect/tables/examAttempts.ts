import { Table } from "@confect/core";
import { examAttemptValidator } from "@repo/backend/confect/exams/sittings/schema";

/**
 * One student's attempt in a proctored sitting. An attempt is read by its ID, so
 * the table has no index yet (ADR 0013).
 */
export default Table.make(() => examAttemptValidator);
