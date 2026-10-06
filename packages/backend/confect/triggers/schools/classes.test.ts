import { DatabaseWriter, RegisteredConvexFunction } from "@confect/server";
import { assert, expect, it } from "@effect/vitest";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { triggers } from "@repo/backend/confect/functions";
import { schoolActivitySchema } from "@repo/backend/confect/schools/schema";
import { schoolClassesHandler } from "@repo/backend/confect/triggers/schools/classes";
import { createClassFixture } from "@repo/backend/test/classes";
import { Array as Arr, Effect, pipe, Schema, Struct } from "effect";

it("records a native class rename without inventing visibility changes", async () => {
  const { t, classId } = await createClassFixture();
  await t.mutation((ctx) =>
    Effect.runPromise(
      DatabaseWriter.make(databaseSchema, triggers.wrapDB(ctx).db)
        .table("schoolClasses")
        .patch(classId, {
          name: "Advanced Algebra",
        })
        .pipe(
          Effect.orDie,
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)
          )
        )
    )
  );
  const events = await t.query((ctx) =>
    ctx.db.query("schoolActivityLogs").take(20)
  );
  expect(
    pipe(
      events,
      Arr.filter((event) => event.action === "class_updated"),
      Arr.map((event) => event.metadata)
    )
  ).toEqual([
    {
      className: "Advanced Algebra",
      oldName: "Algebra",
      newName: "Advanced Algebra",
    },
  ]);
});
it.effect.each(["archiver", "editor", "creator"] as const)(
  "preserves class edits, archive state and cleanup (actor: %s)",
  (actor) =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const { t, users, classId } = yield* Effect.promise(createClassFixture);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const original = await ctx.db.get("schoolClasses", classId);
          assert(original);
          const changed = {
            ...Struct.omit(original, ["archivedBy", "updatedBy"]),
            name: "Advanced Algebra",
            subject: "Physics",
            year: "2027",
            visibility: "public" as const,
            isArchived: true,
            archivedAt: 1234,
            ...(actor === "archiver"
              ? {
                  archivedBy: users.student.userId,
                }
              : {}),
            ...(actor === "creator"
              ? {}
              : {
                  updatedBy: users.outsider.userId,
                }),
          };
          await Effect.runPromiseWith(runtimeServices)(
            schoolClassesHandler({
              id: classId,
              operation: "update",
              oldDoc: original,
              newDoc: changed,
            }).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)
              )
            )
          );
          await Effect.runPromiseWith(runtimeServices)(
            schoolClassesHandler({
              id: classId,
              operation: "update",
              oldDoc: changed,
              newDoc: changed,
            }).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)
              )
            )
          );
          await Effect.runPromiseWith(runtimeServices)(
            schoolClassesHandler({
              id: classId,
              operation: "delete",
              oldDoc: changed,
              newDoc: null,
            }).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)
              )
            )
          );
        })
      );
      const state = yield* Effect.promise(() =>
        t.query(async (ctx) => ({
          events: await ctx.db.query("schoolActivityLogs").take(20),
          scheduled: await ctx.db.system.query("_scheduled_functions").take(5),
        }))
      );
      const events = Arr.filter(
        state.events,
        (event) => event.entityId === classId
      );
      expect(Arr.map(events, (event) => event.action)).toEqual([
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
          oldSubject: "Mathematics",
          newSubject: "Physics",
          oldYear: "2026",
          newYear: "2027",
          oldVisibility: "private",
          newVisibility: "public",
        },
      });
      expect(events[3].userId).toBe(
        actor === "creator" ? users.admin.userId : users.outsider.userId
      );
      expect(state.scheduled).toContainEqual(
        expect.objectContaining({
          args: [
            {
              classId,
            },
          ],
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
