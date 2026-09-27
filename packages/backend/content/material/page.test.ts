import { describe, expect, it } from "@effect/vitest";
import { encodePageCursor } from "@repo/backend/confect/contentRelease/cursor";
import { runConvexProgram } from "@repo/backend/confect/runtime";
import { convexModules } from "@repo/backend/confect/test.setup";
import { convexMaterialLayer } from "@repo/backend/content/material/convex";
import { readMaterialPage } from "@repo/backend/content/material/page";
import schema from "@repo/backend/convex/schema";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  activateMaterialCatalog,
  advanceMaterialCatalog,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material/catalog";
import { insertRuntimeBinding } from "@repo/backend/test/runtime/head";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("contentRelease/material/page", () => {
  it("rejects forged material positions and cross-locale reuse", async () => {
    const t = convexTest(schema, convexModules);
    await activateMaterialCatalog(t);
    const first = await t.query((ctx) =>
      runConvexProgram(
        readMaterialPage("en", null, null, { cursor: null, numItems: 1 }).pipe(
          Effect.provide(convexMaterialLayer(ctx))
        )
      )
    );
    for (const cursor of [
      "publication-page:{",
      encodePageCursor("category", "blue", "unused"),
      encodePageCursor("material", "green", "unused"),
      encodePageCursor("material", "blue", "material-route|{"),
      encodePageCursor(
        "material",
        "blue",
        'material-route|["green","en","/en/materials/algebra"]'
      ),
    ]) {
      await expect(
        t.query((ctx) =>
          runConvexProgram(
            readMaterialPage(
              "en",
              MATERIAL_IDENTITY.manifestHash,
              MATERIAL_IDENTITY.releaseId,
              { cursor, numItems: 1 }
            ).pipe(Effect.provide(convexMaterialLayer(ctx)))
          )
        )
      ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
    }
    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readMaterialPage(
            "de",
            MATERIAL_IDENTITY.manifestHash,
            MATERIAL_IDENTITY.releaseId,
            { cursor: first.result.continueCursor, numItems: 1 }
          ).pipe(Effect.provide(convexMaterialLayer(ctx)))
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it("resumes a native cursor issued for the current material index", async () => {
    const t = convexTest(schema, convexModules);
    await activateMaterialCatalog(t);
    const issued = await t.query((ctx) =>
      ctx.db
        .query("materialCatalog")
        .withIndex("by_slot_and_appLocale_and_publicPath", (q) =>
          q.eq("slot", "blue").eq("appLocale", "en")
        )
        .paginate({ cursor: null, numItems: 1 })
    );
    expect(issued.isDone).toBe(false);
    const next = await t.query((ctx) =>
      runConvexProgram(
        readMaterialPage(
          "en",
          MATERIAL_IDENTITY.manifestHash,
          MATERIAL_IDENTITY.releaseId,
          {
            cursor: encodePageCursor("material", "blue", issued.continueCursor),
            numItems: 1,
          }
        ).pipe(Effect.provide(convexMaterialLayer(ctx)))
      )
    );
    expect(next).toMatchObject({
      managed: true,
      stale: false,
      result: { isDone: true, page: [expect.any(String)] },
    });
    expect(next.result.page[0]).not.toBe(issued.page[0]?.projectionJson);
  });

  it("returns an empty unmanaged page before material publication", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readMaterialPage("en", null, null, {
            cursor: null,
            numItems: 2,
          }).pipe(Effect.provide(convexMaterialLayer(ctx)))
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
        readMaterialPage("en", null, null, { cursor: null, numItems: 1 }).pipe(
          Effect.provide(convexMaterialLayer(ctx))
        )
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
            "en",
            MATERIAL_IDENTITY.manifestHash,
            MATERIAL_IDENTITY.releaseId,
            {
              cursor: first.result.continueCursor,
              numItems: 1,
            }
          ).pipe(Effect.provide(convexMaterialLayer(ctx)))
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
        readMaterialPage("en", null, null, { cursor: null, numItems: 1 }).pipe(
          Effect.provide(convexMaterialLayer(ctx))
        )
      )
    );

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readMaterialPage("en", "stale", "stale", {
            cursor: first.result.continueCursor,
            numItems: 1,
          }).pipe(Effect.provide(convexMaterialLayer(ctx)))
        )
      )
    ).resolves.toMatchObject({
      managed: true,
      result: { isDone: true, page: [] },
      stale: true,
    });
  });

  it("restarts a native cursor from the retired index query", async () => {
    const t = convexTest(schema, convexModules);
    await activateMaterialCatalog(t);

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readMaterialPage(
            "en",
            MATERIAL_IDENTITY.manifestHash,
            MATERIAL_IDENTITY.releaseId,
            { cursor: "retired-native-cursor", numItems: 1 }
          ).pipe(Effect.provide(convexMaterialLayer(ctx)))
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
          readMaterialPage(removed.appLocale, null, null, {
            cursor: null,
            numItems: 2,
          }).pipe(Effect.provide(convexMaterialLayer(ctx)))
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
          readMaterialPage("en", null, null, {
            cursor: null,
            endCursor: "caller-owned",
            numItems: 1,
          }).pipe(Effect.provide(convexMaterialLayer(ctx)))
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });
});
