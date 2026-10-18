import type { ExamSittingsDoc } from "@repo/backend/confect/_generated/docs";

/**
 * The view of a stored sitting, as `SittingView` declares it. The view holds no token,
 * no token hash, and no scheduled job, so a read never returns them (ADR 0013).
 */
export const sittingView = (row: ExamSittingsDoc) => ({
  closesAt: row.closesAt,
  cohortId: row.cohortId,
  examId: row.examId,
  id: row._id,
  opensAt: row.opensAt,
  room: row.room,
  state: row.state,
  unitId: row.unitId,
});
