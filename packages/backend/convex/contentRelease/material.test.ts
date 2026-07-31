import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material-catalog";
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

  it("rejects a route reread after the active release changes", async () => {
    const t = convexTest(schema, convexModules);
    const material = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(t);

    await expect(
      t.query(api.contentRelease.material.route, {
        expectedActiveReleaseId: "another-release",
        locale: material.locale,
        publicPath: material.publicPath,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
    await expect(
      t.query(api.contentRelease.material.route, {
        expectedActiveReleaseId: MATERIAL_IDENTITY.releaseId,
        locale: material.locale,
        publicPath: material.publicPath,
      })
    ).resolves.toMatchObject({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
      managed: true,
    });
  });
});
