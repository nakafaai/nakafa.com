import type { ExamSittingsDoc } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  RoomName,
  SittingGroup,
  SittingState,
} from "@repo/backend/confect/exams/sittings/schema";
import { TimeZone } from "@repo/backend/confect/tenancy/locale";
import { Schema } from "effect";

/**
 * One room of an exam as the rooms list shows it: the room, the group it runs for (its cohort, or its unit when the
 * room holds no cohort, as a sitting is scheduled for it) with the name the school gives that group, its opening and
 * its closing in the time zone of its unit, its state, and whether the caller may cancel it. A room holds no token
 * (ADR 0013).
 */
export const RoomRow = Schema.Struct({
  canCancel: Schema.Boolean,
  closesAt: Schema.Finite,
  group: SittingGroup,
  groupName: Schema.String,
  id: Id("examSittings"),
  opensAt: Schema.Finite,
  room: RoomName,
  state: SittingState,
  timeZone: TimeZone,
});

/**
 * The row of one stored sitting. The caller reads the group's name, the unit's time zone, and
 * whether the caller may cancel the room, and passes them in, so this function reads nothing and
 * only shapes the row; the group itself is the stored sitting's cohort, or its unit.
 */
export const roomRow = (
  row: ExamSittingsDoc,
  groupName: string,
  timeZone: typeof TimeZone.Type,
  canCancel: boolean
): typeof RoomRow.Type => ({
  canCancel,
  closesAt: row.closesAt,
  group:
    row.cohortId === null
      ? { kind: "unit", unitId: row.unitId }
      : { cohortId: row.cohortId, kind: "cohort" },
  groupName,
  id: row._id,
  opensAt: row.opensAt,
  room: row.room,
  state: row.state,
  timeZone,
});
