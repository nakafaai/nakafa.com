import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const audit = makeFunctionReference<
  "action",
  Record<string, never>,
  { complete: boolean; inventoryVersion: string }
>("contentRelease/cutover/audit:audit");

describe("contentRelease/cutover/audit", () => {
  it("fails closed before writes when one production count differs", async () => {
    const t = convexTest(schema, convexModules);

    await expect(t.action(audit, {})).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_INTEGRITY",
        message: expect.stringContaining("articleReferences expected 232"),
      },
    });
    await expect(
      t.run((ctx) => ctx.db.query("contentCutoverState").take(1))
    ).resolves.toEqual([]);
  });
});
