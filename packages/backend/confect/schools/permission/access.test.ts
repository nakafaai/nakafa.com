import { Ref } from "@confect/core";
import { DatabaseReader as NativeDatabaseReader } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import type { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { runConvexProgram } from "@repo/backend/confect/runtime";
import { requirePermission } from "@repo/backend/confect/schools/permission/access";
import {
  PERMISSIONS,
  PermissionDenied,
  PermissionDeniedWire,
} from "@repo/backend/confect/schools/permission/spec";
import { api } from "@repo/backend/convex/_generated/api";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { createClassFixture } from "@repo/backend/test/classes";
import { Effect, Option, Schema, Struct } from "effect";

function runPermission<A>(
  ctx: QueryCtx,
  program: Effect.Effect<A, PermissionDenied, DatabaseReader>
) {
  return runConvexProgram(
    program.pipe(
      Effect.provide(NativeDatabaseReader.layer(databaseSchema, ctx.db))
    )
  );
}
describe("school and class permission grants", () => {
  it("requires an explicit target and an active school grant", async () => {
    const { t, users, schoolId } = await createClassFixture();
    for (const target of [
      {
        userId: users.admin.userId,
      },
      {
        userId: users.outsider.userId,
        schoolId,
      },
      {
        userId: users.student.userId,
        schoolId,
      },
    ]) {
      const denied = await t.query((ctx) =>
        runPermission(
          ctx,
          requirePermission(PERMISSIONS.CLASS_DELETE, target).pipe(
            Effect.match({
              onFailure: ({ _tag, code, message }) => ({
                _tag,
                code,
                message,
              }),
              onSuccess: () => undefined,
            })
          )
        )
      );
      expect(denied).toEqual({
        _tag: "PermissionDenied",
        code: "FORBIDDEN",
        message: "Permission 'class:delete' required",
      });
    }
    await expect(
      t.query((ctx) =>
        runPermission(
          ctx,
          requirePermission(PERMISSIONS.CLASS_DELETE, {
            userId: users.admin.userId,
            schoolId,
          }).pipe(Effect.as(true))
        )
      )
    ).resolves.toBe(true);
  });
  it("combines class roles with teacher-specific grants without granting unrelated permissions", async () => {
    const { t, users, schoolId, classId } = await createClassFixture();
    const target = {
      classId,
      schoolId,
      userId: users.student.userId,
    };
    await expect(
      t.query((ctx) =>
        runPermission(ctx, requirePermission(PERMISSIONS.CLASS_WRITE, target))
      )
    ).rejects.toMatchObject({
      data: {
        code: "FORBIDDEN",
      },
    });
    const memberId = await t.mutation((ctx) =>
      ctx.db.insert("schoolClassMembers", {
        classId,
        schoolId,
        userId: users.student.userId,
        role: "student",
        updatedAt: 0,
      })
    );
    await expect(
      t.query((ctx) =>
        runPermission(
          ctx,
          requirePermission(
            PERMISSIONS.CONTENT_READ,
            Struct.omit(target, ["schoolId"])
          ).pipe(Effect.as(true))
        )
      )
    ).resolves.toBe(true);
    await expect(
      t.query((ctx) =>
        runPermission(
          ctx,
          requirePermission(PERMISSIONS.CONTENT_DELETE, target)
        )
      )
    ).rejects.toMatchObject({
      data: {
        code: "FORBIDDEN",
      },
    });
    await t.mutation((ctx) =>
      ctx.db.patch("schoolClassMembers", memberId, {
        role: "teacher",
      })
    );
    await expect(
      t.query((ctx) =>
        runPermission(
          ctx,
          requirePermission(PERMISSIONS.CONTENT_DELETE, target)
        )
      )
    ).rejects.toMatchObject({
      data: {
        code: "FORBIDDEN",
      },
    });
    await t.mutation((ctx) =>
      ctx.db.patch("schoolClassMembers", memberId, {
        teacherRole: "co-teacher",
      })
    );
    await expect(
      t.query((ctx) =>
        runPermission(
          ctx,
          requirePermission(PERMISSIONS.CONTENT_DELETE, target).pipe(
            Effect.as(true)
          )
        )
      )
    ).resolves.toBe(true);
    await expect(
      t.query((ctx) =>
        runPermission(ctx, requirePermission(PERMISSIONS.MEMBER_REMOVE, target))
      )
    ).rejects.toMatchObject({
      data: {
        code: "FORBIDDEN",
      },
    });
  });
  it.effect(
    "preserves the public error payload while native references recover the tagged failure",
    () =>
      Effect.gen(function* () {
        const { student, schoolId } = yield* Effect.promise(createClassFixture);
        const failure = yield* Effect.tryPromise(() =>
          student.mutation(api.classes.mutations.createClass, {
            schoolId,
            name: "Forbidden class",
            subject: "Math",
            year: "2026",
            visibility: "private",
          })
        ).pipe(Effect.flip);
        assert(Ref.isConvexError(failure.cause));
        expect(failure.cause.data).toEqual({
          code: "FORBIDDEN",
          message: "Permission 'class:create' required",
        });
        const decoded = yield* Ref.decodeError(
          refs.public.classes.mutations.createClass,
          failure.cause.data
        );
        assert(Option.isSome(decoded));
        expect(decoded.value).toBeInstanceOf(PermissionDenied);
        assert(decoded.value instanceof PermissionDenied);
        expect(
          yield* Schema.encodeEffect(PermissionDeniedWire)(decoded.value)
        ).toEqual(failure.cause.data);
      })
  );
});
