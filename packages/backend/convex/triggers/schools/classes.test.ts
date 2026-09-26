import { assert, expect, it } from "@effect/vitest";
import { schoolActivitySchema } from "@repo/backend/convex/schools/schema";
import { schoolClassesHandler } from "@repo/backend/convex/triggers/schools/classes";
import { createClassFixture } from "@repo/backend/test/classes";
import { Effect, Schema, Struct } from "effect";

it.effect.each(["archiver", "editor", "creator"] as const)(
  "preserves class edits, archive state and cleanup (actor: %s)",
  (actor) =>
    Effect.gen(function* () {
      const { t, users, classId } = yield* Effect.promise(createClassFixture);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const original = await ctx.db.get("schoolClasses", classId);
          assert(original);
          const changed = {
            ...Struct.omit(original, ["archivedBy", "updatedBy"]),
            name: "Advanced Algebra",
            isArchived: true,
            archivedAt: 1234,
            ...(actor === "archiver"
              ? { archivedBy: users.student.userId }
              : {}),
            ...(actor === "creator"
              ? {}
              : { updatedBy: users.outsider.userId }),
          };
          await schoolClassesHandler(ctx, {
            id: classId,
            operation: "update",
            oldDoc: original,
            newDoc: changed,
          });
          await schoolClassesHandler(ctx, {
            id: classId,
            operation: "update",
            oldDoc: changed,
            newDoc: changed,
          });
          await schoolClassesHandler(ctx, {
            id: classId,
            operation: "delete",
            oldDoc: changed,
            newDoc: null,
          });
        })
      );
      const state = yield* Effect.promise(() =>
        t.query(async (ctx) => ({
          events: await ctx.db.query("schoolActivityLogs").take(20),
          scheduled: await ctx.db.system.query("_scheduled_functions").take(5),
        }))
      );
      const events = state.events.filter((event) => event.entityId === classId);
      expect(events.map((event) => event.action)).toEqual([
        "class_created",
        "class_archived",
        "class_updated",
        "class_deleted",
      ]);
      const actors = {
        archiver: users.student.userId,
        editor: users.outsider.userId,
        creator: users.admin.userId,
      };
      expect(events[1]).toMatchObject({
        userId: actors[actor],
        metadata: {
          className: "Advanced Algebra",
          isArchived: true,
          archivedAt: 1234,
        },
      });
      expect(events[2]).toMatchObject({
        metadata: {
          className: "Advanced Algebra",
          oldName: "Algebra",
          newName: "Advanced Algebra",
        },
      });
      expect(events[3].userId).toBe(
        actor === "creator" ? users.admin.userId : users.outsider.userId
      );
      expect(state.scheduled).toContainEqual(
        expect.objectContaining({
          args: [{ classId }],
          name: "triggers/schools/cleanup:cleanupDeletedClass",
        })
      );
      for (const { _id, _creationTime, ...event } of events) {
        const decoded = yield* Schema.decodeEffect(schoolActivitySchema)(event);
        expect(
          yield* Schema.encodeEffect(schoolActivitySchema)(decoded)
        ).toEqual(event);
      }
    })
);
