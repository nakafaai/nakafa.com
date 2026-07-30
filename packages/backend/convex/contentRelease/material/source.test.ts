import { ContentLocaleSchema } from "@nakafa/aksara-contracts/content";
import {
  canonicalizeMaterialProjection,
  MaterialLessonProjectionSchema,
} from "@nakafa/aksara-contracts/projection/material";
import { MATERIAL_SOURCE_LIMIT } from "@repo/backend/convex/contentRelease/material/limits";
import {
  readMaterialClaims,
  readMaterialShell,
} from "@repo/backend/convex/contentRelease/material/source";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import {
  activateMaterialCatalog,
  selectExactMaterial,
} from "@repo/backend/test/material-catalog";
import { convexTest } from "convex-test";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

const testLocale = Schema.decodeUnknownSync(ContentLocaleSchema)("en");

/** Decodes one source-shell projection for exact result assertions. */
function decodeProjection(source: string) {
  return Schema.decodeUnknownSync(MaterialLessonProjectionSchema)(
    JSON.parse(source)
  );
}

describe("contentRelease/material/source", () => {
  it("reads only exact-owned rows across old and new source groups", async () => {
    const target = convexTest(schema, convexModules);
    const current = makeMaterialProjection("en", 1);
    const currentSibling = makeMaterialProjection("en", 2);
    const moved = makeMaterialProjection("en", 1, 1);
    const movedSibling = makeMaterialProjection("en", 2, 1);
    await activateMaterialCatalog(target, [
      current,
      currentSibling,
      moved,
      movedSibling,
    ]);
    await selectExactMaterial(target, current);
    await selectExactMaterial(target, moved);
    const sourceCandidates = [
      {
        contentKey: current.contentKey,
        locale: current.locale,
        parentPath: current.parentPath,
      },
      {
        contentKey: moved.contentKey,
        locale: moved.locale,
        parentPath: moved.parentPath,
      },
    ];

    const result = await target.query((ctx) =>
      runConvexProgram(readMaterialShell(ctx, current.locale, sourceCandidates))
    );

    expect(result.sourceClaims).toMatchObject([
      { contentKey: current.contentKey, kind: "found" },
      { contentKey: moved.contentKey, kind: "found" },
    ]);
    expect(result.sourceProjectionJson.map(decodeProjection)).toEqual([
      current,
      moved,
    ]);
    await expect(
      target.query((ctx) =>
        runConvexProgram(readMaterialClaims(ctx, sourceCandidates))
      )
    ).resolves.toMatchObject([
      { contentKey: current.contentKey, kind: "found" },
      { contentKey: moved.contentKey, kind: "found" },
    ]);
  });

  it("rejects source shells beyond the identity and group bounds", async () => {
    const target = convexTest(schema, convexModules);
    const requested = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target);
    await selectExactMaterial(target, requested);
    const excessiveGroups = [0, 1, 2].map((index) => ({
      contentKey: `material/lesson/test/group-${index}/section`,
      locale: testLocale,
      parentPath: `subjects/test/group-${index}`,
    }));
    const excessiveIdentities = Array.from(
      { length: MATERIAL_SOURCE_LIMIT + 1 },
      (_, index) => ({
        contentKey: `material/lesson/test/large/section-${index}`,
        locale: testLocale,
      })
    );

    for (const candidates of [excessiveGroups, excessiveIdentities]) {
      await expect(
        target.query((ctx) =>
          runConvexProgram(readMaterialShell(ctx, requested.locale, candidates))
        )
      ).rejects.toMatchObject({
        data: { code: "CONTENT_RELEASE_LIMIT" },
      });
    }
  });

  it.each([
    [
      "duplicate",
      [
        { contentKey: "material/test", locale: testLocale },
        { contentKey: "material/test", locale: testLocale },
      ],
    ],
    ["invalid", [{ contentKey: "", locale: testLocale }]],
    [
      "invalid parent",
      [
        {
          contentKey: "material/test",
          locale: testLocale,
          parentPath: "",
        },
      ],
    ],
  ])("rejects a %s source-shell identity", async (_label, candidates) => {
    const target = convexTest(schema, convexModules);
    const requested = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target);
    await selectExactMaterial(target, requested);

    await expect(
      target.query((ctx) =>
        runConvexProgram(readMaterialShell(ctx, requested.locale, candidates))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects a source group beyond the bounded read contract", async () => {
    const target = convexTest(schema, convexModules);
    const requested = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target);
    await target.mutation(async (ctx) => {
      for (let order = 3; order <= 101; order += 1) {
        const projection = makeMaterialProjection("en", order);
        await ctx.db.insert("materialCatalog", {
          assetId: projection.graph.assetId,
          bucket: "abc",
          contentKey: projection.contentKey,
          date: projection.metadata.date,
          locale: projection.locale,
          materialKey: projection.materialKey,
          order: projection.order,
          parentPath: projection.parentPath,
          projectionHash: "not-read",
          projectionJson: canonicalizeMaterialProjection(projection),
          publicPath: projection.publicPath,
          releaseId: "not-read",
          rendererDomain: "mathematics",
          sequence: 1,
          sourcePath: "not-read",
        });
      }
    });
    await selectExactMaterial(target, requested);

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          readMaterialShell(ctx, requested.locale, [
            {
              contentKey: requested.contentKey,
              locale: requested.locale,
              parentPath: requested.parentPath,
            },
          ])
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });
});
