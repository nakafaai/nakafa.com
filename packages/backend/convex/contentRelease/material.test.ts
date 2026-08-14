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
  it("fails closed before current signed ownership is available", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query(api.contentRelease.material.route, {
        appLocale: "en",
        publicPath: "subjects/mathematics/functions/concept",
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_MISSING" },
    });
  });

  it("rejects a route reread after the active release changes", async () => {
    const t = convexTest(schema, convexModules);
    const material = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(t);

    await expect(
      t.query(api.contentRelease.material.route, {
        expectedActiveReleaseId: "another-release",
        appLocale: material.appLocale,
        publicPath: material.publicPath,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
    await expect(
      t.query(api.contentRelease.material.route, {
        expectedActiveReleaseId: MATERIAL_IDENTITY.releaseId,
        appLocale: material.appLocale,
        publicPath: material.publicPath,
      })
    ).resolves.toMatchObject({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
    });
  });
});
