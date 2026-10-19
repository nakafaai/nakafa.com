import { DatabaseReader, DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { Sitting } from "@repo/backend/confect/exams/sittings/access";
import { sittingAuthority } from "@repo/backend/confect/exams/sittings/authority";
import { RoomOpened } from "@repo/backend/confect/exams/sittings/errors";
import { cancelPending } from "@repo/backend/confect/exams/sittings/timers";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { tenantAuthority } from "@repo/backend/confect/tenancy/authority";
import { Array as Arr, Effect, Struct } from "effect";

/**
 * Cancels a scheduled room that has not opened yet. Its pending jobs are cancelled, its row is
 * removed with its token, and the exam unfreezes when no other room of it remains, so its
 * questions can change again. A room that has opened, or closed, stays, because its students sat
 * it. Only the Person who scheduled the room, or an Admin, may cancel it.
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
    return yield* new AccessDenied({ action: "sitting.proctor", reason: "role" });
  }
  if (sitting.state !== "scheduled") {
    return yield* new RoomOpened();
  }
  yield* Effect.forEach(sitting.jobs, (job) => cancelPending(job));
  const writer = yield* DatabaseWriter;
  yield* writer.table("examSittings").delete(sitting._id).pipe(Effect.orDie);
  yield* sittingAuthority.record(personActor(member.person), sitting, {
    type: "sitting.cancel",
  });
  const others = yield* (yield* DatabaseReader)
    .table("examSittings")
    .index("by_examId_and_opensAt", (query) =>
      query.eq("examId", sitting.examId)
    )
    .take(1)
    .pipe(Effect.orDie);
  if (Arr.isReadonlyArrayEmpty(others)) {
    yield* writer
      .table("exams")
      .replace(
        sitting.exam._id,
        Struct.omit(sitting.exam, ["_creationTime", "_id", "frozenAt"])
      )
      .pipe(Effect.orDie);
  }
  return null;
});
