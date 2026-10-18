import { Table } from "@confect/core";
import { examSignalValidator } from "@repo/backend/confect/exams/sittings/schema";

/**
 * The integrity signals of a proctored attempt, kept as events (ADR 0013). The
 * table holds no camera, face, voice, or emotion data (K14).
 */
export default Table.make(() => examSignalValidator);
