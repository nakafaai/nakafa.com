import { RegisteredConvexFunction } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { QuestionResponseSchema } from "@nakafa/aksara-contracts/question/response";
import { canonicalizeContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import { makeTryoutCatalogRecord } from "@nakafa/aksara-contracts/tryout/hash/catalog";
import { makeTryoutPlacementRecord } from "@nakafa/aksara-contracts/tryout/hash/placement";
import {
  tryoutCatalogIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import confectSchema from "@repo/backend/confect/_generated/schema";
import {
  stageTryoutCatalog,
  stageTryoutPlacement,
} from "@repo/backend/confect/contentRelease/snapshot/tryout";
import {
  tryoutCatalogFacts,
  tryoutPlacementFacts,
} from "@repo/backend/confect/contentRelease/tryout/facts";
import {
  TRYOUT_CATALOG_DOCUMENT_LIMIT,
  TRYOUT_PLACEMENT_DOCUMENT_LIMIT,
} from "@repo/backend/confect/contentRelease/tryout/limits";
import { convexModules } from "@repo/backend/confect/test.setup";
import schema from "@repo/backend/convex/schema";
import {
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
} from "@repo/backend/test/tryout/snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const snapshotId = Sha256HashSchema.make(`sha256:${"7".repeat(64)}`);
describe("contentRelease/snapshot/tryout", () => {
  it("replays an immutable placement exactly and rejects index or stored-byte collisions", async () => {
    const placement = makeTryoutPlacementRow();
    const rowJson = canonicalizeContentSnapshotRow(placement);
    const t = convexTest(schema, convexModules);
    const stage = (index: number) =>
      t.mutation((ctx) =>
        Effect.runPromise(
          stageTryoutPlacement(snapshotId, index, placement, rowJson).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      );
    await expect(stage(1)).resolves.toBe(false);
    const original = await t.query((ctx) =>
      ctx.db.query("tryoutPlacements").collect()
    );
    await expect(stage(1)).resolves.toBe(true);
    expect(
      await t.query((ctx) => ctx.db.query("tryoutPlacements").collect())
    ).toEqual(original);
    await expect(stage(2)).rejects.toMatchObject({
      code: "CONTENT_RELEASE_CONFLICT",
    });
    await t.mutation(async (ctx) => {
      const stored = await ctx.db.query("tryoutPlacements").unique();
      assert(stored);
      await ctx.db.patch(stored._id, {
        rowJson: "{}",
      });
    });
    const changed = await t.query((ctx) =>
      ctx.db.query("tryoutPlacements").collect()
    );
    await expect(stage(1)).rejects.toMatchObject({
      code: "CONTENT_RELEASE_CONFLICT",
    });
    expect(
      await t.query((ctx) => ctx.db.query("tryoutPlacements").collect())
    ).toEqual(changed);
  });
  it("stores hierarchy and placement rows in domain-owned tables", async () => {
    const catalog = makeTryoutCatalogRow();
    const placement = makeTryoutPlacementRow();
    const catalogJson = canonicalizeContentSnapshotRow(catalog);
    const placementJson = canonicalizeContentSnapshotRow(placement);
    const t = convexTest(schema, convexModules);
    await expect(
      t.mutation((ctx) =>
        Effect.runPromise(
          stageTryoutCatalog(snapshotId, 0, catalog, catalogJson).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      )
    ).resolves.toBe(false);
    await expect(
      t.mutation((ctx) =>
        Effect.runPromise(
          stageTryoutPlacement(snapshotId, 1, placement, placementJson).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      )
    ).resolves.toBe(false);
    await expect(
      t.run(async (ctx) => ({
        catalog: await ctx.db.query("tryoutCatalog").unique(),
        placement: await ctx.db.query("tryoutPlacements").unique(),
      }))
    ).resolves.toMatchObject({
      catalog: {
        assetId: "asset:en:tryout:technical:country",
        identity: tryoutCatalogIdentity(catalog.record.row),
        kind: "country",
      },
      placement: {
        answerArtifactHash: placement.record.row.answerArtifactHash,
        contentHash: placement.record.row.contentHash,
        identity: tryoutPlacementIdentity(placement.record.row),
        questionArtifactHash: placement.record.row.questionArtifactHash,
        questionOrder: 1,
      },
    });
  });
  it("replays exact rows and rejects index or identity collisions", async () => {
    const catalog = makeTryoutCatalogRow();
    const rowJson = canonicalizeContentSnapshotRow(catalog);
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      Effect.runPromise(
        stageTryoutCatalog(snapshotId, 0, catalog, rowJson).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    await expect(
      t.mutation((ctx) =>
        Effect.runPromise(
          stageTryoutCatalog(snapshotId, 0, catalog, rowJson).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      )
    ).resolves.toBe(true);
    await t.mutation(async (ctx) => {
      const stored = await ctx.db.query("tryoutCatalog").unique();
      if (!stored) {
        throw new Error("Expected one technical try-out catalog row.");
      }
      await ctx.db.patch("tryoutCatalog", stored._id, {
        assetId: "asset:en:tryout:technical:changed",
      });
    });
    await expect(
      t.mutation((ctx) =>
        Effect.runPromise(
          stageTryoutCatalog(snapshotId, 0, catalog, rowJson).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      )
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_CONFLICT",
    });
    await expect(
      t.mutation((ctx) =>
        Effect.runPromise(
          stageTryoutCatalog(snapshotId, 1, catalog, rowJson).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      )
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_CONFLICT",
    });
  });
  it("rejects new or replayed rows beyond aggregate read budgets", async () => {
    const catalogSource = makeTryoutCatalogRow();
    const catalog = {
      ...catalogSource,
      record: makeTryoutCatalogRecord({
        ...catalogSource.record.row,
        description: "x".repeat(TRYOUT_CATALOG_DOCUMENT_LIMIT),
      }),
    };
    const placementSource = makeTryoutPlacementRow();
    const response = placementSource.record.row.response;
    if (
      response.kind !== "single-choice" &&
      response.kind !== "multiple-choice"
    ) {
      throw new Error("Expected one option-based technical response.");
    }
    const [firstOption, ...remainingOptions] = response.options;
    if (!firstOption) {
      throw new Error("Expected one technical response option.");
    }
    const oversizedResponse = QuestionResponseSchema.make({
      kind: response.kind,
      options: [
        {
          ...firstOption,
          label: "x".repeat(TRYOUT_PLACEMENT_DOCUMENT_LIMIT),
        },
        ...remainingOptions,
      ],
    });
    const placement = {
      ...placementSource,
      record: makeTryoutPlacementRecord({
        ...placementSource.record.row,
        response: oversizedResponse,
      }),
    };
    const t = convexTest(schema, convexModules);
    const catalogJson = canonicalizeContentSnapshotRow(catalog);
    const placementJson = canonicalizeContentSnapshotRow(placement);
    await expect(
      t.mutation((ctx) =>
        Effect.runPromise(
          stageTryoutCatalog(snapshotId, 0, catalog, catalogJson).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      )
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_SIZE",
    });
    await expect(
      t.mutation((ctx) =>
        Effect.runPromise(
          stageTryoutPlacement(snapshotId, 1, placement, placementJson).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      )
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_SIZE",
    });
    await t.mutation(async (ctx) => {
      await ctx.db.insert("tryoutCatalog", {
        ...tryoutCatalogFacts(catalog.record),
        index: 0,
        rowHash: catalog.record.rowHash,
        rowJson: catalogJson,
        snapshotId,
      });
      await ctx.db.insert("tryoutPlacements", {
        ...tryoutPlacementFacts(placement.record),
        index: 1,
        rowHash: placement.record.rowHash,
        rowJson: placementJson,
        snapshotId,
      });
    });
    await expect(
      t.mutation((ctx) =>
        Effect.runPromise(
          stageTryoutCatalog(snapshotId, 0, catalog, catalogJson).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      )
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_SIZE",
    });
    await expect(
      t.mutation((ctx) =>
        Effect.runPromise(
          stageTryoutPlacement(snapshotId, 1, placement, placementJson).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      )
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_SIZE",
    });
  });
});
