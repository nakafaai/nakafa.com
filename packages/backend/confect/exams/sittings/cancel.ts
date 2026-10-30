import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { Sitting } from "@repo/backend/confect/exams/sittings/access";
import { sittingAuthority } from "@repo/backend/confect/exams/sittings/authority";
import { RoomOpened } from "@repo/backend/confect/exams/sittings/errors";
import { cancelPending } from "@repo/backend/confect/exams/sittings/timers";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { tenantAuthority } from "@repo/backend/confect/tenancy/authority";
import { Array as Arr, Effect } from "effect";

/**
 * Cancels a scheduled room that has not opened yet. Its pending jobs are cancelled and its row is
 * removed with its token. A room that has opened, or closed, stays, because its students sat it.
 * Only the Person who scheduled the room, or an Admin, may cancel it.
 */
export const cancelRoom = Effect.fn("exams.sittings.cancel")(function* () {
  const sitting = yield* Sitting;
  const member = yield* Member;
  const isScheduler = sitting.scheduledBy === member.person._id;
  const isAdmin = Arr.contains(
    yield* tenantAuthority.allowed(member.tenant),
    "tenant.manage"
  );
  if (!(isScheduler || isAdmin)) {
    return yield* new AccessDenied({
      action: "sitting.proctor",
      reason: "role",
    });
  }
  if (sitting.state !== "scheduled") {
    return yield* new RoomOpened();
  }
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
