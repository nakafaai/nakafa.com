import { describe, expect, it } from "@effect/vitest";
import {
  GitCommitShaSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { ContentReleaseManifestSchema } from "@nakafa/aksara-contracts/release";
import { internal } from "@repo/backend/convex/_generated/api";
import { makePublicationReceipt } from "@repo/backend/convex/contentRelease/receipt";
import {
  PROOF_PAGE_LIMIT,
  PROOF_QUERY_HEADROOM,
} from "@repo/backend/convex/contentRelease/spec";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testMaterialPublicPath } from "@repo/backend/test/content/material";
import {
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import { TEST_RELEASE_ID } from "@repo/backend/test/content/release";
import {
  insertRollbackItem,
  insertRoute,
} from "@repo/backend/test/content/rollback";
import {
  insertSignedCandidate,
  insertTestRelease,
} from "@repo/backend/test/content/stage";
import { convexTest } from "convex-test";
import { Struct } from "effect";

const readCatalog = internal.contentRelease.proof.catalog.page;

/** Inserts a complete staged catalog with an optional measured query budget. */
async function insertCatalogFixture(
  itemCount = PROOF_PAGE_LIMIT + 1,
  databaseQueries?: number
) {
  const t = convexTest({
    schema,
    modules: convexModules,
    transactionLimits:
      databaseQueries === undefined ? false : { databaseQueries },
  });
  await t.mutation(async (ctx) => {
    await insertTestRelease(ctx, {
      checkedIndex: itemCount - 1,
      checkedItems: itemCount,
      itemCount,
      projectionCount: itemCount,
      routeCount: itemCount,
      stagedArtifacts: itemCount,
      stagedItems: itemCount,
      stagedProjections: itemCount,
      stagedRoutes: itemCount,
      stagedUpserts: itemCount,
      status: "verifying",
      upsertCount: itemCount,
    });
    for (let index = 0; index < itemCount; index += 1) {
      const contentKey = `test:head-${index}`;
      const publicPath = testMaterialPublicPath(index);
      await insertRollbackItem(ctx, index, false);
      await insertRoute(ctx, { contentKey, index, publicPath });
      await ctx.db.insert("contentKeys", {
        contentKey,
        createdSequence: 1,
        family: "material",
        artifactLocale: "en",
      });
    }
  });
  return { itemCount, t };
}

/** Freezes an empty candidate or recovery against its real signed base. */
async function insertBaseFixture(role: "candidate" | "recovery") {
  const t = convexTest(schema, convexModules);
  const baseSigned = testSignedRelease(
    testEmptyManifest(ReleaseIdSchema.make("catalog-base"))
  );
  const releaseId = ReleaseIdSchema.make(`catalog-${role}`);
  const empty = testEmptyManifest(releaseId);
  const signed = testSignedRelease(
    ContentReleaseManifestSchema.make({
      ...empty,
      baseActiveAppLocales: baseSigned.manifest.activeAppLocales,
      baseManifestHash: baseSigned.manifestHash,
      baseReleaseId: baseSigned.manifest.releaseId,
      origin:
        role === "candidate"
          ? empty.origin
          : { kind: "rollback", releaseId: baseSigned.manifest.releaseId },
    })
  );
  const ids = await t.mutation(async (ctx) => {
    await insertSignedCandidate(
      ctx,
      baseSigned.manifest.releaseId,
      baseSigned,
      JSON.stringify(TEST_PROOF_RENDERER)
    );
    const base = await ctx.db.query("contentReleases").unique();
    const state = await ctx.db.query("contentState").unique();
    if (!(base && state)) {
      throw new Error("Expected a signed catalog base.");
    }
    await ctx.db.patch("contentReleases", base._id, {
      proofAt: 1,
      proofJson: "{}",
      verifiedAt: 1,
      ...(role === "candidate"
        ? {
            completedAt: 1,
            receiptJson: JSON.stringify(
              makePublicationReceipt(base, baseSigned)
            ),
            status: "completed" as const,
          }
        : { status: "verified" as const }),
    });
    const pendingId = await ctx.db.insert("contentReleases", {
      ...Struct.omit(base, ["_id", "_creationTime"]),
      releaseId,
      releaseJson: JSON.stringify(signed),
      role,
      sequence: 2,
      status: "verifying",
    });
    await ctx.db.patch("contentState", state._id, {
      nextSequence: 3,
      ...(role === "candidate"
        ? {
            activeManifestHash: baseSigned.manifestHash,
            activeReleaseId: base.releaseId,
            activeSequence: 1,
            candidateManifestHash: signed.manifestHash,
            candidateReleaseId: releaseId,
            candidateSequence: 2,
          }
        : {
            recoveryManifestHash: signed.manifestHash,
            recoveryReleaseId: releaseId,
            recoverySequence: 2,
          }),
    });
    return { baseId: base._id, pendingId, stateId: state._id };
  });
  return { ...ids, baseSigned, releaseId, t };
}

describe("contentRelease/proof/catalog", () => {
  it("advances through a full logical page without gaps or duplicates", async () => {
    const { itemCount, t } = await insertCatalogFixture();

    const first = await t.query(readCatalog, {
      cursor: null,
      releaseId: TEST_RELEASE_ID,
    });
    const second = await t.query(readCatalog, {
      cursor: first.nextCursor,
      releaseId: TEST_RELEASE_ID,
    });
    const keys = [...first.heads, ...second.heads].map(
      ({ contentKey }) => contentKey
    );

    expect(first.done).toBe(false);
    expect(first.heads).toHaveLength(PROOF_PAGE_LIMIT);
    expect(first.nextCursor).not.toBeNull();
    expect(second).toMatchObject({ done: true, nextCursor: null });
    expect(second.heads).toHaveLength(1);
    expect(new Set(keys).size).toBe(itemCount);
    expect(keys).toEqual([...keys].sort());
    expect(keys).toContain(`test:head-${itemCount - 1}`);
  });

  it("yields before exhausting the measured query budget and resumes exactly", async () => {
    const { t } = await insertCatalogFixture(3, PROOF_QUERY_HEADROOM + 5);
    const first = await t.query(readCatalog, {
      cursor: null,
      releaseId: TEST_RELEASE_ID,
    });
    expect(first.done).toBe(false);
    expect(first.heads).toHaveLength(2);
    const second = await t.query(readCatalog, {
      cursor: first.nextCursor,
      releaseId: TEST_RELEASE_ID,
    });
    expect(second).toMatchObject({ done: true, nextCursor: null });
    expect(
      [...first.heads, ...second.heads].map((head) => head.contentKey)
    ).toEqual(["test:head-0", "test:head-1", "test:head-2"]);
  });

  it("keeps the frozen sequence and advances past absent permanent identities", async () => {
    const { t } = await insertCatalogFixture(1);
    await t.mutation(async (ctx) => {
      const head = await ctx.db.query("contentHeads").unique();
      if (!head) {
        throw new Error("Expected a catalog head.");
      }
      await ctx.db.insert("contentHeads", {
        contentKey: head.contentKey,
        artifactLocale: head.artifactLocale,
        family: head.family,
        index: 0,
        operation: "delete",
        releaseId: "future-release",
        sequence: 2,
      });
      await ctx.db.insert("contentKeys", {
        contentKey: "test:removed",
        artifactLocale: "en",
        createdSequence: 1,
        family: "material",
      });
    });
    await expect(
      t.query(readCatalog, { cursor: null, releaseId: TEST_RELEASE_ID })
    ).resolves.toMatchObject({
      done: true,
      heads: [{ contentKey: "test:head-0" }],
      nextCursor: null,
    });
  });

  it("resumes remaining locales for one key before advancing to later keys", async () => {
    const { t } = await insertCatalogFixture(2);
    const page = await t.query(readCatalog, {
      cursor: { artifactLocale: "de", contentKey: "test:head-0" },
      releaseId: TEST_RELEASE_ID,
    });
    expect(page).toMatchObject({ done: true, nextCursor: null });
    expect(
      page.heads.map(({ contentKey, artifactLocale }) => [
        contentKey,
        artifactLocale,
      ])
    ).toEqual([
      ["test:head-0", "en"],
      ["test:head-1", "en"],
    ]);
  });

  it.each(["candidate", "recovery"] as const)(
    "authenticates the exact %s base before exposing its catalog",
    async (role) => {
      const { t, releaseId } = await insertBaseFixture(role);
      await expect(
        t.query(readCatalog, { cursor: null, releaseId })
      ).resolves.toEqual({ done: true, heads: [], nextCursor: null });
    }
  );

  it("accepts a verified signed genesis and rejects premature proof access", async () => {
    const t = convexTest(schema, convexModules);
    const releaseId = ReleaseIdSchema.make("catalog-genesis");
    const signed = testSignedRelease(testEmptyManifest(releaseId));
    const ids = await t.mutation(async (ctx) => {
      await insertSignedCandidate(
        ctx,
        releaseId,
        signed,
        JSON.stringify(TEST_PROOF_RENDERER)
      );
      const release = await ctx.db.query("contentReleases").unique();
      const state = await ctx.db.query("contentState").unique();
      if (!(release && state)) {
        throw new Error("Expected a signed genesis.");
      }
      return { releaseId: release._id, stateId: state._id };
    });
    await expect(
      t.query(readCatalog, { cursor: null, releaseId })
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_STATE",
        message: expect.stringContaining("cannot expose"),
      },
    });
    await t.mutation((ctx) =>
      ctx.db.patch("contentReleases", ids.releaseId, {
        proofAt: 1,
        proofJson: "{}",
        status: "verified",
        verifiedAt: 1,
      })
    );
    await expect(
      t.query(readCatalog, { cursor: null, releaseId })
    ).resolves.toEqual({
      done: true,
      heads: [],
      nextCursor: null,
    });
    await t.mutation((ctx) =>
      ctx.db.patch("contentState", ids.stateId, { activeSequence: 1 })
    );
    await expect(
      t.query(readCatalog, { cursor: null, releaseId })
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_INTEGRITY",
        message: expect.stringContaining("nonempty genesis"),
      },
    });
    await t.mutation((ctx) => ctx.db.delete("contentState", ids.stateId));
    await expect(
      t.query(readCatalog, { cursor: null, releaseId })
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_STATE",
        message: expect.stringContaining("no publication state"),
      },
    });
  });

  it.each(["candidate", "recovery"] as const)(
    "fences the %s base by release, manifest, and complete sequence identity",
    async (role) => {
      const { t, releaseId, stateId, baseSigned } =
        await insertBaseFixture(role);
      await t.mutation((ctx) =>
        ctx.db.patch(
          "contentState",
          stateId,
          role === "candidate"
            ? { activeReleaseId: "foreign-base" }
            : { candidateReleaseId: "foreign-base" }
        )
      );
      await expect(
        t.query(readCatalog, { cursor: null, releaseId })
      ).rejects.toMatchObject({
        data: {
          code: "CONTENT_RELEASE_STATE",
          message: expect.stringContaining("lost its result-catalog base"),
        },
      });
      await t.mutation((ctx) =>
        ctx.db.patch(
          "contentState",
          stateId,
          role === "candidate"
            ? {
                activeReleaseId: baseSigned.manifest.releaseId,
                activeManifestHash: `sha256:${"f".repeat(64)}`,
              }
            : {
                candidateReleaseId: baseSigned.manifest.releaseId,
                candidateManifestHash: `sha256:${"f".repeat(64)}`,
              }
        )
      );
      await expect(
        t.query(readCatalog, { cursor: null, releaseId })
      ).rejects.toMatchObject({
        data: {
          code: "CONTENT_RELEASE_STATE",
          message: expect.stringContaining("lost its result-catalog base"),
        },
      });
      await t.mutation((ctx) =>
        ctx.db.patch(
          "contentState",
          stateId,
          role === "candidate"
            ? {
                activeManifestHash: baseSigned.manifestHash,
                activeSequence: undefined,
              }
            : {
                candidateManifestHash: baseSigned.manifestHash,
                candidateSequence: undefined,
              }
        )
      );
      await expect(
        t.query(readCatalog, { cursor: null, releaseId })
      ).rejects.toMatchObject({
        data: {
          code: "CONTENT_RELEASE_INTEGRITY",
          message: expect.stringContaining("incomplete base identity"),
        },
      });
    }
  );

  it.each([
    { role: "candidate" as const, patch: { sequence: 9 }, label: "sequence" },
    {
      role: "candidate" as const,
      patch: { status: "verified" as const },
      label: "completion",
    },
    {
      role: "recovery" as const,
      patch: { role: "recovery" as const },
      label: "candidate role",
    },
    {
      role: "recovery" as const,
      patch: { status: "staging" as const },
      label: "verification",
    },
  ])(
    "rejects a $role base with invalid $label evidence",
    async ({ role, patch }) => {
      const { t, baseId, releaseId } = await insertBaseFixture(role);
      await t.mutation((ctx) => ctx.db.patch("contentReleases", baseId, patch));
      await expect(
        t.query(readCatalog, { cursor: null, releaseId })
      ).rejects.toMatchObject({
        data: {
          code: "CONTENT_RELEASE_INTEGRITY",
          message: expect.stringContaining("invalid catalog base"),
        },
      });
    }
  );

  it("rejects replacement signed base bytes even when the stored sequence still matches", async () => {
    const { t, baseId, baseSigned, releaseId } =
      await insertBaseFixture("candidate");
    const replacement = testSignedRelease(
      ContentReleaseManifestSchema.make({
        ...baseSigned.manifest,
        origin: { kind: "git", sha: GitCommitShaSchema.make("b".repeat(40)) },
      })
    );
    await t.mutation((ctx) =>
      ctx.db.patch("contentReleases", baseId, {
        releaseJson: JSON.stringify(replacement),
      })
    );
    await expect(
      t.query(readCatalog, { cursor: null, releaseId })
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_INTEGRITY",
        message: expect.stringContaining("invalid catalog base"),
      },
    });
  });
});
