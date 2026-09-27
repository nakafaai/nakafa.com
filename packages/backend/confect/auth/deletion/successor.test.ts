import { RegisteredConvexFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { ACCOUNT_DELETION_SUCCESSOR_PAGE_SIZE } from "@repo/backend/confect/auth/deletion/constants";
import { findSchoolOwnershipSuccessorPage } from "@repo/backend/confect/auth/deletion/successor";
import { convexModules } from "@repo/backend/confect/test.setup";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 6, 28, 8, 0, 0);
function insertUser(ctx: MutationCtx, suffix: string, deletedAt?: number) {
  return Effect.promise(() =>
    ctx.db.insert("users", {
      authId: `successor-${suffix}`,
      credits: 0,
      creditsResetAt: 0,
      ...(deletedAt === undefined
        ? {}
        : {
            deletedAt,
          }),
      email: `successor-${suffix}@example.com`,
      name: `Successor ${suffix}`,
      plan: "free",
    })
  );
}
describe("auth/deletion/successor", () => {
  it.effect("continues past a full page of deleting members", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const t = convexTest(schema, convexModules);
      const seeded = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            Effect.gen(function* () {
              const ownerId = yield* insertUser(ctx, "owner");
              const schoolId = yield* Effect.promise(() =>
                ctx.db.insert("schools", {
                  city: "Jakarta",
                  createdBy: ownerId,
                  currentStudents: ACCOUNT_DELETION_SUCCESSOR_PAGE_SIZE + 1,
                  currentTeachers: 0,
                  email: "successor-school@example.com",
                  name: "Successor School",
                  province: "DKI Jakarta",
                  slug: "successor-school",
                  type: "high-school",
                  updatedAt: NOW,
                })
              );
              for (
                let index = 0;
                index < ACCOUNT_DELETION_SUCCESSOR_PAGE_SIZE;
                index += 1
              ) {
                const userId = yield* insertUser(ctx, `deleting-${index}`, NOW);
                yield* Effect.promise(() =>
                  ctx.db.insert("schoolMembers", {
                    joinedAt: NOW,
                    role: "student",
                    schoolId,
                    status: "active",
                    updatedAt: NOW,
                    userId,
                  })
                );
              }
              const successorId = yield* insertUser(ctx, "active");
              const successorMembershipId = yield* Effect.promise(() =>
                ctx.db.insert("schoolMembers", {
                  joinedAt: NOW,
                  role: "student",
                  schoolId,
                  status: "active",
                  updatedAt: NOW,
                  userId: successorId,
                })
              );
              return {
                ownerId,
                schoolId,
                successorMembershipId,
              };
            }).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      );
      const firstPage = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            findSchoolOwnershipSuccessorPage(
              seeded.schoolId,
              seeded.ownerId,
              null
            ).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      );
      expect(firstPage.kind).toBe("continue");
      if (firstPage.kind !== "continue") {
        return;
      }
      const secondPage = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            findSchoolOwnershipSuccessorPage(
              seeded.schoolId,
              seeded.ownerId,
              firstPage.cursor
            ).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      );
      expect(secondPage).toMatchObject({
        kind: "found",
        successorMembership: {
          _id: seeded.successorMembershipId,
        },
      });
    })
  );
});
