import type { GenericId } from "@confect/core";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { GENERAL_CHANNEL_NAME } from "@repo/backend/confect/classroom/forum/channel";
import { Effect } from "effect";

/**
 * Writes the general channel of a class, the room every member of the class
 * reads. `classes.create` writes it in the same transaction as the class, so a
 * class never exists without it, and it takes position 0, ahead of every topic.
 */
export const insertGeneral = Effect.fn("classroom.forum.general.insert")(
  function* (
    classId: GenericId.GenericId<"classes">,
    tenantId: GenericId.GenericId<"tenants">,
    createdAt: number
  ) {
    return yield* (yield* DatabaseWriter)
      .table("classroomChannels")
      .insert({
        classId,
        createdAt,
        kind: "general",
        name: GENERAL_CHANNEL_NAME,
        position: 0,
        tenantId,
      })
      .pipe(Effect.orDie);
  }
);
