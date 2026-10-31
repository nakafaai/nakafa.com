import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { sittingAuthority } from "@repo/backend/confect/exams/sittings/authority";
import { changeableRoom } from "@repo/backend/confect/exams/sittings/change";
import {
  checkTimes,
  sittingJobs,
} from "@repo/backend/confect/exams/sittings/schedule";
import type { RoomName } from "@repo/backend/confect/exams/sittings/schema";
import { cancelPending } from "@repo/backend/confect/exams/sittings/timers";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { Effect } from "effect";

/**
 * Moves a scheduled room that has not opened yet to a new time and room name. Its pending jobs, the opening, the
 * closing and the notices before it, are cancelled and scheduled again at the new times, in the same transaction,
 * so no job of the old times fires. The token and the group stay. The times follow the schedule's rule, and only
 * the Person who scheduled the room, or an Admin, may move it.
 */
export const rescheduleRoom = Effect.fn("exams.sittings.reschedule")(
  function* (args: {
    readonly closesAt: number;
    readonly opensAt: number;
    readonly room: typeof RoomName.Type;
  }) {
    const { member, sitting } = yield* changeableRoom();
    yield* checkTimes(args.opensAt, args.closesAt);
    yield* Effect.forEach(sitting.jobs, (job) => cancelPending(job));
    const jobs = yield* sittingJobs({
      _id: sitting._id,
      closesAt: args.closesAt,
      opensAt: args.opensAt,
      unitId: sitting.unitId,
    });
    yield* (yield* DatabaseWriter)
      .table("examSittings")
      .patch(sitting._id, {
        closesAt: args.closesAt,
        jobs,
        opensAt: args.opensAt,
        room: args.room,
      })
      .pipe(Effect.orDie);
    yield* sittingAuthority.record(
      personActor(member.person),
      { ...sitting, ...args, jobs },
      { type: "sitting.reschedule" }
    );
    return null;
  }
);
