import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { sittingAuthority } from "@repo/backend/confect/exams/sittings/authority";
import { changeableRoom } from "@repo/backend/confect/exams/sittings/change";
import { cancelPending } from "@repo/backend/confect/exams/sittings/timers";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { Effect } from "effect";

/**
 * Cancels a scheduled room that has not opened yet. Its pending jobs are cancelled and its row is
 * removed with its token. A room that has opened, or closed, stays, because its students sat it.
 * Only the Person who scheduled the room, or an Admin, may cancel it.
 */
export const cancelRoom = Effect.fn("exams.sittings.cancel")(function* () {
  const { member, sitting } = yield* changeableRoom();
  yield* Effect.forEach(sitting.jobs, (job) => cancelPending(job));
  yield* (yield* DatabaseWriter)
    .table("examSittings")
    .delete(sitting._id)
    .pipe(Effect.orDie);
  yield* sittingAuthority.record(personActor(member.person), sitting, {
    type: "sitting.cancel",
  });
  return null;
});
