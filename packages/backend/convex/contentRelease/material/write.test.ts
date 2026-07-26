import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { hashContentProjection } from "@nakafa/aksara-contracts/projection/hash";
import {
  canonicalizeMaterialProjection,
  type MaterialLessonProjection,
} from "@nakafa/aksara-contracts/projection/material";
import type { resolvePublicProjection } from "@repo/backend/convex/contentRelease/catalog";
import {
  deleteMaterial,
  writeMaterial,
} from "@repo/backend/convex/contentRelease/material/write";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { ingressProjection } from "@repo/backend/test/content-ingress";
import { convexTest } from "convex-test";
import type { Effect } from "effect";
import { describe, expect, it } from "vitest";

type PublicProjection = NonNullable<
  Effect.Effect.Success<ReturnType<typeof resolvePublicProjection>>
>;

/** Builds one resolved public material projection for the writer boundary. */
function testResolved(
  options?: {
    readonly family?: PublicProjection["family"];
    readonly projectionHash?: string;
    readonly projectionJson?: string;
    readonly publicPath?: PublicProjection["publicPath"];
    readonly sequence?: number;
    readonly sourcePath?: string;
  },
  projection: MaterialLessonProjection = ingressProjection
): PublicProjection {
  return {
    contentKey: projection.contentKey,
    family: options?.family ?? "material",
    locale: projection.locale,
    projectionHash:
      options?.projectionHash ?? hashContentProjection(projection),
    projectionJson:
      options?.projectionJson ?? canonicalizeMaterialProjection(projection),
    publicPath: options?.publicPath ?? projection.publicPath,
    releaseId: "release-material-write",
    rendererDomain: "mathematics",
    sequence: options?.sequence ?? 1,
    sourcePath: options?.sourcePath ?? "packages/corpus/test/head-0/en.mdx",
  };
}

describe("contentRelease/material/write", () => {
  it("replaces and deletes one localized material identity", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      runConvexProgram(writeMaterial(ctx, testResolved(), ingressProjection))
    );
    const updated = {
      ...ingressProjection,
      metadata: {
        ...ingressProjection.metadata,
        description: "Updated material summary.",
        title: "Updated Material",
      },
      topicTitle: "Updated Topic",
    };
    await t.mutation((ctx) =>
      runConvexProgram(
        writeMaterial(ctx, testResolved({ sequence: 2 }, updated), updated)
      )
    );

    const [stored] = await t.run((ctx) =>
      ctx.db.query("materialCatalog").take(2)
    );
    expect(stored).toMatchObject({
      projectionJson: canonicalizeMaterialProjection(updated),
      sequence: 2,
    });
    expect(stored).not.toHaveProperty("description");
    expect(stored).not.toHaveProperty("title");
    expect(stored).not.toHaveProperty("topicTitle");
    await t.mutation((ctx) =>
      runConvexProgram(
        deleteMaterial(
          ctx,
          ingressProjection.contentKey,
          ingressProjection.locale
        )
      )
    );
    await t.mutation((ctx) =>
      runConvexProgram(
        deleteMaterial(
          ctx,
          ingressProjection.contentKey,
          ingressProjection.locale
        )
      )
    );
    await expect(
      t.run((ctx) => ctx.db.query("materialCatalog").take(1))
    ).resolves.toEqual([]);
  });

  it("rejects unsafe heads and oversized material metadata", async () => {
    const t = convexTest(schema, convexModules);
    for (const head of [
      testResolved({ family: "article" }),
      testResolved({ projectionHash: "" }),
      testResolved({ projectionHash: `sha256:${"0".repeat(64)}` }),
      testResolved({ projectionJson: "" }),
      testResolved({ publicPath: PublicPathSchema.make("test/other") }),
      testResolved({ sourcePath: "" }),
    ]) {
      await expect(
        t.mutation((ctx) =>
          runConvexProgram(writeMaterial(ctx, head, ingressProjection))
        )
      ).rejects.toMatchObject({
        data: { code: "CONTENT_RELEASE_INTEGRITY" },
      });
    }
    await expect(
      t.mutation((ctx) => {
        const projection = {
          ...ingressProjection,
          metadata: {
            ...ingressProjection.metadata,
            title: "x".repeat(900_000),
          },
        };
        return runConvexProgram(
          writeMaterial(ctx, testResolved(undefined, projection), projection)
        );
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_SIZE" } });
  });
});
