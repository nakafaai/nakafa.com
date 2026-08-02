import { canonicalizeContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot-data";
import { makeTryoutCatalogRecord } from "@nakafa/aksara-contracts/tryout/row-hash";
import {
  type TryoutCatalogRow,
  TryoutCatalogRowSchema,
} from "@nakafa/aksara-contracts/tryout/spec";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  tryoutCatalogFacts,
  tryoutCatalogSetIdentity,
} from "@repo/backend/convex/contentRelease/tryout/facts";
import { migrateTryoutSetIdentity } from "@repo/backend/convex/contentRelease/tryout/setIdentity/impl";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeTryoutCatalogRow } from "@repo/backend/test/tryout-snapshot";
import { convexTest } from "convex-test";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

const snapshotId = `sha256:${"5".repeat(64)}`;

/** Creates one signed technical section with a unique catalog identity. */
function makeSection(index = 0) {
  return Schema.decodeUnknownSync(TryoutCatalogRowSchema)({
    countryKey: "indonesia",
    examKey: "snbt",
    graph: {
      alignmentId: `alignment:tryout:technical:section-${index}`,
      assetId: `asset:en:tryout:technical:section-${index}`,
      conceptId: `concept:tryout:technical:section-${index}`,
      learningObjectId: `lo:tryout-technical-section-${index}`,
      lensId: "lens:tryout:technical",
    },
    kind: "section",
    locale: "en",
    order: index + 1,
    publicPath: `try-out/indonesia/snbt/2027/set-1/section-${index}`,
    questionCount: 1,
    questionSourcePath: `packages/corpus/question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1/section-${index}`,
    sectionKey: `section-${index}`,
    setKey: "set-1",
    sourceRevision: "technical-revision",
    timeLimitSeconds: 60,
    title: `Technical section ${index}`,
    trackKey: "2027",
    visibility: "visible",
  });
}

/** Inserts one signed catalog row in the exact pre-migration shape. */
function insertOldCatalog(ctx: MutationCtx, row: TryoutCatalogRow) {
  const record = makeTryoutCatalogRecord(row);
  const facts = tryoutCatalogFacts(record);
  return ctx.db.insert("tryoutCatalog", {
    identity: facts.identity,
    index: row.order,
    kind: facts.kind,
    locale: facts.locale,
    order: facts.order,
    publicPath: facts.publicPath,
    rowHash: record.rowHash,
    rowJson: canonicalizeContentSnapshotRow({
      family: "tryout",
      record,
      rowKind: "catalog",
    }),
    snapshotId,
  });
}

describe("contentRelease/tryout/setIdentity", () => {
  it("previews, applies, and verifies the exact signed catalog migration", async () => {
    const target = convexTest(schema, convexModules);
    const section = makeSection();
    const country = makeTryoutCatalogRow().record.row;
    await target.mutation(async (ctx) => {
      await insertOldCatalog(ctx, section);
      await insertOldCatalog(ctx, country);
    });

    await expect(
      target.mutation(internal.contentRelease.tryout.setIdentity.migrate, {
        apply: false,
        expectedMissing: 1,
      })
    ).resolves.toEqual({ candidates: 1, updated: 0 });
    await expect(
      target.mutation(internal.contentRelease.tryout.setIdentity.migrate, {
        apply: true,
        expectedMissing: 1,
      })
    ).resolves.toEqual({ candidates: 1, updated: 1 });
    await expect(
      target.mutation(internal.contentRelease.tryout.setIdentity.migrate, {
        apply: false,
        expectedMissing: 0,
      })
    ).resolves.toEqual({ candidates: 0, updated: 0 });

    const migrated = await target.run((ctx) =>
      ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_identity", (query) =>
          query
            .eq("snapshotId", snapshotId)
            .eq(
              "identity",
              tryoutCatalogFacts(makeTryoutCatalogRecord(section)).identity
            )
        )
        .unique()
    );
    expect(migrated?.setIdentity).toBe(tryoutCatalogSetIdentity(section));
  });

  it("rejects count drift and invalid operator bounds", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation((ctx) => insertOldCatalog(ctx, makeSection()));

    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          migrateTryoutSetIdentity(ctx, {
            apply: false,
            expectedMissing: 0,
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_CONFLICT" },
    });

    for (const expectedMissing of [-1, 1.5, 101]) {
      await expect(
        target.mutation((ctx) =>
          runConvexProgram(
            migrateTryoutSetIdentity(ctx, {
              apply: false,
              expectedMissing,
            })
          )
        )
      ).rejects.toMatchObject({
        data: { code: "CONTENT_RELEASE_LIMIT" },
      });
    }
  });

  it("rejects corrupt, unexpected, and invalid stored identities", async () => {
    const corrupt = convexTest(schema, convexModules);
    await corrupt.mutation(async (ctx) => {
      const id = await insertOldCatalog(ctx, makeSection());
      await ctx.db.patch("tryoutCatalog", id, { rowHash: "invalid" });
    });
    await expect(
      corrupt.mutation((ctx) =>
        runConvexProgram(
          migrateTryoutSetIdentity(ctx, {
            apply: false,
            expectedMissing: 1,
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const unexpected = convexTest(schema, convexModules);
    await unexpected.mutation(async (ctx) => {
      const country = makeTryoutCatalogRow().record.row;
      const id = await insertOldCatalog(ctx, country);
      await ctx.db.patch("tryoutCatalog", id, { setIdentity: "unexpected" });
    });
    await expect(
      unexpected.mutation((ctx) =>
        runConvexProgram(
          migrateTryoutSetIdentity(ctx, {
            apply: false,
            expectedMissing: 0,
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const invalid = convexTest(schema, convexModules);
    await invalid.mutation(async (ctx) => {
      const id = await insertOldCatalog(ctx, makeSection());
      await ctx.db.patch("tryoutCatalog", id, { setIdentity: "invalid" });
    });
    await expect(
      invalid.mutation((ctx) =>
        runConvexProgram(
          migrateTryoutSetIdentity(ctx, {
            apply: false,
            expectedMissing: 0,
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects catalogs beyond the guarded migration scope", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation(async (ctx) => {
      for (let index = 0; index <= 100; index += 1) {
        await insertOldCatalog(ctx, makeSection(index));
      }
    });

    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          migrateTryoutSetIdentity(ctx, {
            apply: false,
            expectedMissing: 100,
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });
});
