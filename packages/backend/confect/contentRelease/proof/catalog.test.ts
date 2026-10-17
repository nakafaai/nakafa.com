import { assert, describe, expect, it } from "@effect/vitest";
import {
  GitCommitShaSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { ContentReleaseManifestSchema } from "@nakafa/aksara-contracts/release";
import {
  PROOF_PAGE_LIMIT,
  PROOF_QUERY_HEADROOM,
} from "@repo/backend/confect/contentRelease/spec";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import {
  encodeReleaseJson,
  encodeRendererJson,
  insertBaseFixture,
} from "@repo/backend/test/content/catalog";
import { insertQuestionHead } from "@repo/backend/test/content/head";
import { testMaterialPublicPath } from "@repo/backend/test/content/material";
import {
  TEST_PROOF_RENDERER,
  testSignedEmptyRelease,
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
import { Array as Arr, Effect, Order } from "effect";

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
    const keys = Arr.map(
      [...first.heads, ...second.heads],
      ({ contentKey }) => contentKey
    );

    expect(first.done).toBe(false);
    expect(first.heads).toHaveLength(PROOF_PAGE_LIMIT);
    expect(first.nextCursor).not.toBeNull();
    expect(second).toMatchObject({ done: true, nextCursor: null });
    expect(second.heads).toHaveLength(1);
    expect(Arr.dedupe(keys).length).toBe(itemCount);
    expect(keys).toEqual(Arr.sort(keys, Order.String));
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
      Arr.map([...first.heads, ...second.heads], (head) => head.contentKey)
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
      Arr.map(page.heads, ({ contentKey, artifactLocale }) => [
        contentKey,
        artifactLocale,
      ])
    ).toEqual([
      ["test:head-0", "en"],
      ["test:head-1", "en"],
    ]);
  });

  it.effect.each(["candidate", "recovery"] as const)(
    "authenticates the exact %s base before exposing its catalog",
    (role) =>
      Effect.gen(function* () {
        const { t, releaseId } = yield* insertBaseFixture(role);
        yield* Effect.promise(() =>
          expect(
            t.query(readCatalog, { cursor: null, releaseId })
          ).resolves.toEqual({ done: true, heads: [], nextCursor: null })
        );
      })
  );

  it.effect(
    "accepts a verified signed genesis and rejects premature proof access",
    () =>
      Effect.gen(function* () {
        const releaseId = ReleaseIdSchema.make("catalog-genesis");
        const signed = yield* testSignedEmptyRelease(releaseId);
        yield* Effect.promise(async () => {
          const t = convexTest(schema, convexModules);
          const ids = await t.mutation(async (ctx) => {
            await insertSignedCandidate(
              ctx,
              releaseId,
              signed,
              encodeRendererJson(TEST_PROOF_RENDERER)
            );
            const release = await ctx.db.query("contentReleases").unique();
            const state = await ctx.db.query("contentState").unique();
            assert(release && state, "Expected a signed genesis.");
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
      })
  );

  it.effect.each(["candidate", "recovery"] as const)(
    "fences the %s base by release, manifest, and complete sequence identity",
    (role) =>
      Effect.gen(function* () {
        const { t, releaseId, stateId, baseSigned } =
          yield* insertBaseFixture(role);
        yield* Effect.promise(async () => {
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
        });
      })
  );

  it.effect.each([
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
  ])("rejects a $role base with invalid $label evidence", ({ role, patch }) =>
    Effect.gen(function* () {
      const { t, baseId, releaseId } = yield* insertBaseFixture(role);
      yield* Effect.promise(async () => {
        await t.mutation((ctx) =>
          ctx.db.patch("contentReleases", baseId, patch)
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
    })
  );

  it.effect(
    "rejects replacement signed base bytes even when the stored sequence still matches",
    () =>
      Effect.gen(function* () {
        const { t, baseId, baseSigned, releaseId } =
          yield* insertBaseFixture("candidate");
        const replacement = yield* testSignedRelease(
          ContentReleaseManifestSchema.make({
            ...baseSigned.manifest,
            origin: {
              kind: "git",
              sha: GitCommitShaSchema.make("b".repeat(40)),
            },
          })
        );
        yield* Effect.promise(async () => {
          await t.mutation((ctx) =>
            ctx.db.patch("contentReleases", baseId, {
              releaseJson: encodeReleaseJson(replacement),
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
      })
  );
});

it("includes question heads in canonical proof without public routes", async () => {
  const { t } = await insertCatalogFixture(0);
  await t.mutation(insertQuestionHead);
  const page = await t.query(readCatalog, {
    cursor: null,
    releaseId: TEST_RELEASE_ID,
  });
  expect(page.heads).toHaveLength(1);
  expect(page.heads[0]).toMatchObject({ family: "question" });
  expect(page.heads[0]).not.toHaveProperty("publicPath");
});
