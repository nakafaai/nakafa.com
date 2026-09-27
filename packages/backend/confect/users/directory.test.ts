import { describe, expect, it } from "@effect/vitest";
import { runConvexProgram } from "@repo/backend/confect/runtime";
import { convexModules } from "@repo/backend/confect/test.setup";
import {
  getAppUserByAuthId,
  getUserMap,
} from "@repo/backend/confect/users/directory";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import schema from "@repo/backend/convex/schema";
import { convexTest } from "convex-test";

describe("users/directory", () => {
  it("returns an empty map without reading documents for no requested users", async () => {
    const t = convexTest(schema, convexModules);
    await t.query(async (ctx) => {
      const get = vi.spyOn(ctx.db, "get");
      expect(await runConvexProgram(getUserMap(ctx, []))).toEqual(new Map());
      expect(get).not.toHaveBeenCalled();
    });
  });
  it("deduplicates requested IDs and preserves surviving user data when a user is missing", async () => {
    const t = convexTest(schema, convexModules);
    const [firstId, missingId, secondId] = await t.mutation(async (ctx) => {
      const ids: Id<"users">[] = [];
      for (const suffix of ["first", "missing", "second"]) {
        ids.push(
          await ctx.db.insert("users", {
            authId: `auth-${suffix}`,
            credits: 100,
            creditsResetAt: 0,
            email: `${suffix}@example.com`,
            image: `/avatars/${suffix}.png`,
            name: suffix,
            plan: "free",
          })
        );
      }
      return ids;
    });
    await t.mutation((ctx) => ctx.db.delete("users", missingId));
    await t.query(async (ctx) => {
      const get = vi.spyOn(ctx.db, "get");
      const users = await runConvexProgram(
        getUserMap(ctx, [firstId, missingId, firstId, secondId])
      );
      expect(get).toHaveBeenCalledTimes(3);
      expect([...users.keys()]).toEqual([firstId, secondId]);
      expect(users.get(firstId)).toEqual({
        _id: firstId,
        email: "first@example.com",
        image: "/avatars/first.png",
        name: "first",
      });
      expect(users.get(secondId)?.name).toBe("second");
      expect(users.has(missingId)).toBe(false);
    });
  });
  it("looks up the app user by auth identity and returns null for an unknown identity", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation((ctx) =>
      ctx.db.insert("users", {
        authId: "auth-known",
        credits: 100,
        creditsResetAt: 0,
        email: "known@example.com",
        name: "Known user",
        plan: "free",
      })
    );
    await t.query(async (ctx) => {
      expect(
        await runConvexProgram(getAppUserByAuthId(ctx, "auth-known"))
      ).toMatchObject({
        _id: userId,
        name: "Known user",
      });
      expect(
        await runConvexProgram(getAppUserByAuthId(ctx, "auth-missing"))
      ).toBeNull();
    });
  });
});
