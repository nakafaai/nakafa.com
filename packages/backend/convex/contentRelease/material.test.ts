import {
  canonicalizeMaterialProjection,
  MaterialLessonProjectionSchema,
} from "@nakafa/aksara-contracts/projection/material";
import { api } from "@repo/backend/convex/_generated/api";
import { PredecessorMaterialProjectionSchema } from "@repo/backend/convex/contentRelease/material/predecessor";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material-catalog";
import { convexTest } from "convex-test";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

const publication = api.contentRelease.material.publication;
const publications = api.contentRelease.material.publications;
const predecessorPage = api.contentRelease.material.page;
const predecessorRoute = api.contentRelease.material.route;

const decodeCurrent = Schema.decodeUnknownSync(MaterialLessonProjectionSchema);
const decodePredecessor = Schema.decodeUnknownSync(
  PredecessorMaterialProjectionSchema
);

describe("contentRelease/material", () => {
  it("fails closed before current signed ownership is available", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query(predecessorRoute, {
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
      t.query(predecessorRoute, {
        expectedActiveReleaseId: "another-release",
        appLocale: material.appLocale,
        publicPath: material.publicPath,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
    await expect(
      t.query(predecessorRoute, {
        expectedActiveReleaseId: MATERIAL_IDENTITY.releaseId,
        appLocale: material.appLocale,
        publicPath: material.publicPath,
      })
    ).resolves.toMatchObject({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
    });
  });

  it.each(["en", "id", "de"] as const)(
    "keeps the %s predecessor page cursor and release identity",
    async (appLocale) => {
      const t = convexTest(schema, convexModules);
      await activateMaterialCatalog(t);

      const first = await t.query(predecessorPage, {
        expectedManifestHash: null,
        expectedReleaseId: null,
        appLocale,
        paginationOpts: { cursor: null, numItems: 1 },
      });
      const second = await t.query(predecessorPage, {
        expectedManifestHash: first.activeManifestHash,
        expectedReleaseId: first.activeReleaseId,
        appLocale,
        paginationOpts: {
          cursor: first.result.continueCursor,
          numItems: 1,
        },
      });
      const current = await t.query(publications, {
        expectedManifestHash: null,
        expectedReleaseId: null,
        appLocale,
        paginationOpts: { cursor: null, numItems: 1 },
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
        const projection = decodePredecessor(JSON.parse(source), {
          onExcessProperty: "error",
        });
        expect(projection.appLocale).toBe(appLocale);
        expect(projection.metadata).toHaveProperty("date");
        expect(projection.metadata).not.toHaveProperty("datePublished");
        expect(canonicalizeMaterialProjection(projection)).toBe(source);
      }
      const currentProjection = decodeCurrent(
        JSON.parse(current.result.page[0] ?? "{}"),
        { onExcessProperty: "error" }
      );
      expect(currentProjection.metadata).toHaveProperty("datePublished");
      expect(currentProjection.metadata).not.toHaveProperty("date");
      expect(current).toMatchObject({
        activeManifestHash: first.activeManifestHash,
        activeReleaseId: first.activeReleaseId,
      });
    }
  );

  it.each(["en", "id", "de"] as const)(
    "keeps the %s predecessor route exact across alternates and siblings",
    async (appLocale) => {
      const t = convexTest(schema, convexModules);
      const requested = makeMaterialProjection(appLocale, 1);
      await activateMaterialCatalog(t);

      const predecessor = await t.query(predecessorRoute, {
        appLocale,
        publicPath: requested.publicPath,
      });
      const current = await t.query(publication, {
        appLocale,
        publicPath: requested.publicPath,
      });
      const predecessorSources = [
        predecessor.projectionJson ?? "{}",
        ...predecessor.alternateJson,
        ...predecessor.siblingJson,
      ];

      expect(predecessor.alternateJson).toHaveLength(3);
      expect(predecessor.siblingJson).toHaveLength(2);
      for (const source of predecessorSources) {
        const projection = decodePredecessor(JSON.parse(source), {
          onExcessProperty: "error",
        });
        expect(projection.metadata).toHaveProperty("date");
        expect(projection.metadata).not.toHaveProperty("datePublished");
        expect(canonicalizeMaterialProjection(projection)).toBe(source);
      }
      expect(current.projectionJson).toBe(
        canonicalizeMaterialProjection(requested)
      );
      expect(current).toMatchObject({
        activeManifestHash: predecessor.activeManifestHash,
        activeAppLocales: predecessor.activeAppLocales,
        activeReleaseId: predecessor.activeReleaseId,
        rendererDomain: predecessor.rendererDomain,
        sourcePath: predecessor.sourcePath,
        sourceRevision: predecessor.sourceRevision,
      });
      for (const source of [
        current.projectionJson ?? "{}",
        ...current.alternateJson,
        ...current.siblingJson,
      ]) {
        const projection = decodeCurrent(JSON.parse(source), {
          onExcessProperty: "error",
        });
        expect(projection.metadata).toHaveProperty("datePublished");
        expect(projection.metadata).not.toHaveProperty("date");
        expect(canonicalizeMaterialProjection(projection)).toBe(source);
      }
    }
  );
});
