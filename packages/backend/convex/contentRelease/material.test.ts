import { describe, expect, it } from "@effect/vitest";
import {
  canonicalizeMaterialProjection,
  MaterialLessonProjectionSchema,
} from "@nakafa/aksara-contracts/projection/material";
import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material/catalog";
import { convexTest } from "convex-test";
import { Schema } from "effect";

const publication = api.contentRelease.material.publication;
const publications = api.contentRelease.material.publications;
const decodeProjection = Schema.decodeUnknownSync(
  MaterialLessonProjectionSchema
);

describe("contentRelease/material", () => {
  it("fails closed before current signed ownership is available", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query(publication, {
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
      t.query(publication, {
        expectedActiveReleaseId: "another-release",
        appLocale: material.appLocale,
        publicPath: material.publicPath,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
    await expect(
      t.query(publication, {
        expectedActiveReleaseId: MATERIAL_IDENTITY.releaseId,
        appLocale: material.appLocale,
        publicPath: material.publicPath,
      })
    ).resolves.toMatchObject({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
    });
  });

  it.each(["en", "id", "de"] as const)(
    "returns the %s current page with stable release identity",
    async (appLocale) => {
      const t = convexTest(schema, convexModules);
      await activateMaterialCatalog(t);

      const first = await t.query(publications, {
        expectedManifestHash: null,
        expectedReleaseId: null,
        appLocale,
        paginationOpts: { cursor: null, numItems: 1 },
      });
      const second = await t.query(publications, {
        expectedManifestHash: first.activeManifestHash,
        expectedReleaseId: first.activeReleaseId,
        appLocale,
        paginationOpts: {
          cursor: first.result.continueCursor,
          numItems: 1,
        },
      });

      expect(first).toMatchObject({
        activeManifestHash: MATERIAL_IDENTITY.manifestHash,
        activeReleaseId: MATERIAL_IDENTITY.releaseId,
        managed: true,
        result: { isDone: false },
        stale: false,
      });
      expect(second).toMatchObject({
        activeManifestHash: MATERIAL_IDENTITY.manifestHash,
        activeReleaseId: MATERIAL_IDENTITY.releaseId,
        managed: true,
        result: { isDone: true },
        stale: false,
      });
      for (const source of [...first.result.page, ...second.result.page]) {
        const projection = decodeProjection(JSON.parse(source), {
          onExcessProperty: "error",
        });
        expect(projection.appLocale).toBe(appLocale);
        expect(projection.metadata).toHaveProperty("datePublished");
        expect(projection.metadata).not.toHaveProperty("date");
        expect(canonicalizeMaterialProjection(projection)).toBe(source);
      }
    }
  );

  it.each(["en", "id", "de"] as const)(
    "returns the %s current route across alternates and siblings",
    async (appLocale) => {
      const t = convexTest(schema, convexModules);
      const requested = makeMaterialProjection(appLocale, 1);
      await activateMaterialCatalog(t);

      const result = await t.query(publication, {
        appLocale,
        publicPath: requested.publicPath,
      });

      expect(result.projectionJson).toBe(
        canonicalizeMaterialProjection(requested)
      );
      expect(result.alternateJson).toHaveLength(3);
      expect(result.siblingJson).toHaveLength(2);
      for (const source of [
        result.projectionJson ?? "{}",
        ...result.alternateJson,
        ...result.siblingJson,
      ]) {
        const projection = decodeProjection(JSON.parse(source), {
          onExcessProperty: "error",
        });
        expect(projection.metadata).toHaveProperty("datePublished");
        expect(projection.metadata).not.toHaveProperty("date");
        expect(canonicalizeMaterialProjection(projection)).toBe(source);
      }
    }
  );
});
