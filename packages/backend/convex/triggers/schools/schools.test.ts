import { assert, expect, it } from "@effect/vitest";
import { schoolActivitySchema } from "@repo/backend/convex/schools/schema";
import { schoolsHandler } from "@repo/backend/convex/triggers/schools/schools";
import { createClassFixture } from "@repo/backend/test/classes";
import { Effect, Schema, Struct } from "effect";

it.effect.each([true, false])(
  "preserves school changes and deletion actors (explicit actor: %s)",
  (explicitActor) =>
    Effect.gen(function* () {
      const { t, users, schoolId } = yield* Effect.promise(createClassFixture);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const original = await ctx.db.get("schools", schoolId);
          assert(original);
          const changed = {
            ...Struct.omit(original, ["updatedBy"]),
            name: "Renamed School",
            phone: "021-999999",
            ...(explicitActor ? { updatedBy: users.student.userId } : {}),
          };
          await schoolsHandler(ctx, {
            id: schoolId,
            operation: "update",
            oldDoc: original,
            newDoc: changed,
          });
          await schoolsHandler(ctx, {
            id: schoolId,
            operation: "update",
            oldDoc: changed,
            newDoc: changed,
          });
          await schoolsHandler(ctx, {
            id: schoolId,
            operation: "delete",
            oldDoc: changed,
            newDoc: null,
          });
        })
      );
      const events = yield* Effect.promise(() =>
        t.query((ctx) =>
          ctx.db
            .query("schoolActivityLogs")
            .withIndex("by_schoolId", (query) => query.eq("schoolId", schoolId))
            .take(20)
        )
      );
      const schoolEvents = events.filter(
        (event) => event.entityType === "schools"
      );
      expect(schoolEvents.map((event) => event.action)).toEqual([
        "school_created",
        "school_updated",
        "school_deleted",
      ]);
      expect(schoolEvents[1]).toMatchObject({
        userId: explicitActor ? users.student.userId : users.admin.userId,
        metadata: {
          schoolName: "Renamed School",
          oldName: "Class School",
          newName: "Renamed School",
          oldPhone: "021-123456",
          newPhone: "021-999999",
        },
      });
      expect(schoolEvents[2].userId).toBe(schoolEvents[1].userId);
      for (const { _id, _creationTime, ...event } of schoolEvents) {
        const decoded = yield* Schema.decodeEffect(schoolActivitySchema)(event);
        expect(
          yield* Schema.encodeEffect(schoolActivitySchema)(decoded)
        ).toEqual(event);
      }
    })
);
