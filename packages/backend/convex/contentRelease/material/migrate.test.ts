import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentRelease/material/migrate", () => {
  it("exposes the guarded migration through one internal route", async () => {
    const target = convexTest(schema, convexModules);

    await expect(
      target.mutation(internal.contentRelease.material.migrate.migrate, {
        apply: false,
        expectedMissing: -1,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });
});
