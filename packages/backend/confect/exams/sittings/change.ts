import { AccessDenied } from "@repo/backend/confect/access/errors";
import { Sitting } from "@repo/backend/confect/exams/sittings/access";
import { RoomOpened } from "@repo/backend/confect/exams/sittings/errors";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { tenantAuthority } from "@repo/backend/confect/tenancy/authority";
import { Array as Arr, Effect } from "effect";

/**
 * The room a change names, with the member who asks for it, once the change is allowed: the caller holds
 * `sitting.schedule`, which the access middleware decides, and only the Person who scheduled the room, or an
 * Admin, changes it, and only before it opens, because a room that has opened, or
 * closed, keeps its students' sitting as it was.
 */
export const changeableRoom = Effect.fn("exams.sittings.changeable")(
  function* () {
    const sitting = yield* Sitting;
    const member = yield* Member;
    const isScheduler = sitting.scheduledBy === member.person._id;
    const isAdmin = Arr.contains(
      yield* tenantAuthority.allowed(member.tenant),
      "tenant.manage"
    );
    if (!(isScheduler || isAdmin)) {
      return yield* new AccessDenied({
        action: "sitting.schedule",
        reason: "role",
      });
    }
    if (sitting.state !== "scheduled") {
      return yield* new RoomOpened();
    }
    return { member, sitting };
  }
);
