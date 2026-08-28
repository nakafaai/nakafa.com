import { describe, expect, it } from "@effect/vitest";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  hasUserErasureHold,
  requireMigrationUsersAvailable,
} from "@repo/backend/convex/tryouts/migration/erasure";
import { seedMigrationHold } from "@repo/backend/test/migration/seed";
import { Effect } from "effect";

describe("tryouts/migration/erasure", () => {
  it.effect("holds exactly the user named by a migration audit", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const hold = await seedMigrationHold(ctx, "migration-erasure-hold");
          const otherUserId = await ctx.db.insert("users", {
            authId: "migration-erasure-other",
            credits: 0,
            creditsResetAt: 1,
            email: "migration-erasure-other@example.com",
            name: "Migration erasure other",
            plan: "free",
          });
          return { otherUserId, userId: hold.userId };
        })
      );

      const holds = yield* Effect.promise(() =>
        t.query((ctx) =>
          runConvexProgram(
            Effect.all({
              audited: hasUserErasureHold(ctx, seeded.userId),
              other: hasUserErasureHold(ctx, seeded.otherUserId),
            })
          )
        )
      );

      expect(holds).toEqual({ audited: true, other: false });
    })
  );

  it.effect("rejects authorization for an owner under erasure", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const users = yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const active = await ctx.db.insert("users", {
            authId: "migration-active-owner",
            credits: 0,
            creditsResetAt: 1,
            email: "migration-active-owner@example.com",
            name: "Migration active owner",
            plan: "free",
          });
          const deleting = await ctx.db.insert("users", {
            authId: "migration-deleting-owner",
            credits: 0,
            creditsResetAt: 1,
            deletionPreparedAt: 1,
            email: "migration-deleting-owner@example.com",
            name: "Migration deleting owner",
            plan: "free",
          });
          return { active, deleting };
        })
      );

      yield* Effect.promise(() =>
        t.query((ctx) =>
          runConvexProgram(
            requireMigrationUsersAvailable(ctx, [
              { attempt: { userId: users.active } },
            ])
          )
        )
      );
      yield* Effect.promise(() =>
        expect(
          t.query((ctx) =>
            runConvexProgram(
              requireMigrationUsersAvailable(ctx, [
                { attempt: { userId: users.deleting } },
              ])
            )
          )
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_STATE" },
        })
      );
    })
  );
});
