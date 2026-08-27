import { describe, expect, it } from "@effect/vitest";
import { readMaterialPage } from "@repo/backend/convex/contentRelease/material/page";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  activateMaterialCatalog,
  advanceMaterialCatalog,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material/catalog";
import { insertRuntimeBinding } from "@repo/backend/test/runtime/head";
import { convexTest } from "convex-test";

describe("contentRelease/material/page", () => {
  it("returns an empty unmanaged page before material publication", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readMaterialPage(ctx, "en", null, null, { cursor: null, numItems: 2 })
        )
      )
    ).resolves.toMatchObject({
      managed: false,
      result: { isDone: true, page: [] },
      stale: false,
    });
  });

  it("paginates verified materials under one release identity", async () => {
    const t = convexTest(schema, convexModules);
    await activateMaterialCatalog(t);
    const first = await t.query((ctx) =>
      runConvexProgram(
        readMaterialPage(ctx, "en", null, null, { cursor: null, numItems: 1 })
      )
    );

    expect(first).toMatchObject({
      activeManifestHash: MATERIAL_IDENTITY.manifestHash,
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
      managed: true,
      result: { isDone: false, page: [expect.any(String)] },
      sourceRevision: "a".repeat(40),
      stale: false,
    });
    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readMaterialPage(
            ctx,
            "en",
            MATERIAL_IDENTITY.manifestHash,
            MATERIAL_IDENTITY.releaseId,
            {
              cursor: first.result.continueCursor,
              numItems: 1,
            }
          )
        )
      )
    ).resolves.toMatchObject({
      managed: true,
      result: { isDone: true, page: [expect.any(String)] },
      stale: false,
    });
  });

  it("returns a stable stale page for a superseded cursor identity", async () => {
    const t = convexTest(schema, convexModules);
    await activateMaterialCatalog(t);
    const first = await t.query((ctx) =>
      runConvexProgram(
        readMaterialPage(ctx, "en", null, null, { cursor: null, numItems: 1 })
      )
    );

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readMaterialPage(ctx, "en", "stale", "stale", {
            cursor: first.result.continueCursor,
            numItems: 1,
          })
        )
      )
    ).resolves.toMatchObject({
      managed: true,
      result: { isDone: true, page: [] },
      stale: true,
    });
  });

  it("rejects catalog rows removed from the effective publication", async () => {
    const t = convexTest(schema, convexModules);
    const removed = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(t);
    await t.mutation((ctx) =>
      insertRuntimeBinding(ctx, null, {
        appLocale: removed.appLocale,
        bindingReleaseId: "release-next",
        bindingSequence: 2,
        publicPath: removed.publicPath,
      })
    );
    await advanceMaterialCatalog(t);

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readMaterialPage(ctx, removed.appLocale, null, null, {
            cursor: null,
            numItems: 2,
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_ROUTE" },
    });
  });

  it("rejects caller-owned end cursors", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readMaterialPage(ctx, "en", null, null, {
            cursor: null,
            endCursor: "caller-owned",
            numItems: 1,
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });
});
