import { DatabaseWriter, RegisteredConvexFunction } from "@confect/server";
import { assert, expect, it } from "@effect/vitest";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { triggers } from "@repo/backend/confect/functions";
import { schoolActivitySchema } from "@repo/backend/confect/schools/schema";
import { schoolsHandler } from "@repo/backend/confect/triggers/schools/schools";
import { createClassFixture } from "@repo/backend/test/classes";
import { Effect, Schema, Struct } from "effect";

it("records only the fields changed by each native school write", async () => {
  const { t, schoolId } = await createClassFixture();
  await t.mutation((ctx) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const writer = DatabaseWriter.make(
          databaseSchema,
          triggers.wrapDB(ctx).db
        );
        yield* writer.table("schools").patch(schoolId, {
          name: "Renamed School",
        });
        yield* writer.table("schools").patch(schoolId, {
          email: "updated@example.com",
        });
      }).pipe(
        Effect.orDie,
        Effect.provide(
          RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)
        )
      )
    )
  );
  const events = await t.query((ctx) =>
    ctx.db
      .query("schoolActivityLogs")
      .withIndex("by_schoolId", (query) => query.eq("schoolId", schoolId))
      .take(20)
  );
  expect(
    events
      .filter((event) => event.action === "school_updated")
      .map((event) => event.metadata)
  ).toEqual([
    {
      schoolName: "Renamed School",
      oldName: "Class School",
      newName: "Renamed School",
    },
    {
      schoolName: "Renamed School",
      oldEmail: "class-school@example.com",
      newEmail: "updated@example.com",
    },
  ]);
});
it.effect.each([true, false])(
  "preserves school changes and deletion actors (explicit actor: %s)",
  (explicitActor) =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const { t, users, schoolId } = yield* Effect.promise(createClassFixture);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const original = await ctx.db.get("schools", schoolId);
          assert(original);
          const changed = {
            ...Struct.omit(original, ["updatedBy"]),
            name: "Renamed School",
            phone: "021-999999",
            email: "renamed-school@example.com",
            address: "Jl. Pahlawan 2",
            city: "Bandung",
            province: "Jawa Barat",
            type: "middle-school" as const,
            ...(explicitActor
              ? {
                  updatedBy: users.student.userId,
                }
              : {}),
          };
          await Effect.runPromiseWith(runtimeServices)(
            schoolsHandler({
              id: schoolId,
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
            schoolsHandler({
              id: schoolId,
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
            schoolsHandler({
              id: schoolId,
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
          oldEmail: "class-school@example.com",
          newEmail: "renamed-school@example.com",
          oldAddress: "Jl. Merdeka 1",
          newAddress: "Jl. Pahlawan 2",
          oldCity: "Jakarta",
          newCity: "Bandung",
          oldProvince: "DKI Jakarta",
          newProvince: "Jawa Barat",
          oldType: "high-school",
          newType: "middle-school",
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
