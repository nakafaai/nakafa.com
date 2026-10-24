import type { ExamSittingsDoc } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  RoomName,
  SittingState,
} from "@repo/backend/confect/exams/sittings/schema";
import { TimeZone } from "@repo/backend/confect/tenancy/locale";
import { Schema } from "effect";

/**
 * The group a room runs for: its cohort, or its unit when the room holds no cohort. The name
 * is the name the school gives that cohort or unit.
 */
const RoomGroup = Schema.Struct({
  kind: Schema.Literals(["cohort", "unit"]),
  name: Schema.String,
});

/**
 * One room of an exam as the rooms list shows it: the room and its group, its opening and its
 * closing in the time zone of its unit, its state, and whether the caller may cancel it. A room
 * holds no token (ADR 0013).
 */
export const RoomRow = Schema.Struct({
  canCancel: Schema.Boolean,
  closesAt: Schema.Finite,
  group: RoomGroup,
  id: Id("examSittings"),
  opensAt: Schema.Finite,
  room: RoomName,
  state: SittingState,
  timeZone: TimeZone,
});

/**
 * The row of one stored sitting. The caller reads the group's name, the unit's time zone, and
 * whether the caller may cancel the room, and passes them in, so this function reads nothing and
 * only shapes the row.
 */
export const roomRow = (
  row: ExamSittingsDoc,
  group: typeof RoomGroup.Type,
  timeZone: typeof TimeZone.Type,
  canCancel: boolean
): typeof RoomRow.Type => ({
  canCancel,
  closesAt: row.closesAt,
  group,
  id: row._id,
  opensAt: row.opensAt,
  room: row.room,
  state: row.state,
  timeZone,
});
