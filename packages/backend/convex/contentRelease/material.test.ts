import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentRelease/material", () => {
  it("accepts the deployed route argument shape during expansion", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query(api.contentRelease.material.route, {
        locale: "en",
        publicPath: "subjects/mathematics/functions/concept",
      })
    ).resolves.toMatchObject({
      managed: false,
      sourceClaims: [],
    });
  });
});
