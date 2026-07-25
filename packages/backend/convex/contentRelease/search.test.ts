import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testProjectionJson } from "@repo/backend/test/content-release";
import {
  insertTestState,
  type TestIdentity,
} from "@repo/backend/test/content-state";
import {
  insertRuntimeBinding,
  insertRuntimeIndex,
  insertRuntimeVersion,
} from "@repo/backend/test/runtime-head";
import { makeFunctionReference, type PaginationResult } from "convex/server";
import type { Value } from "convex/values";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

interface ProjectionRow {
  readonly contentKey: string;
  readonly family: "material";
  readonly locale: "en";
  readonly projectionHash: string;
  readonly projectionJson: string;
  readonly publicPath: string;
  readonly releaseId: string;
  readonly sequence: number;
}

interface SearchArgs extends Record<string, Value> {
  readonly expectedManifestHash: null | string;
  readonly expectedReleaseId: null | string;
  readonly family: "material";
  readonly locale: "en";
  readonly paginationOpts: {
    readonly cursor: null | string;
    readonly endCursor?: null | string;
    readonly maximumBytesRead?: number;
    readonly maximumRowsRead: number;
    readonly numItems: number;
  };
  readonly query: string;
}

interface SearchResult {
  readonly activeManifestHash: null | string;
  readonly activeReleaseId: null | string;
  readonly result: PaginationResult<ProjectionRow>;
}

const BASE = {
  manifestHash: `sha256:${"5".repeat(64)}`,
  releaseId: "release-search-base",
  sequence: 1,
} satisfies TestIdentity;
const NEXT = {
  manifestHash: `sha256:${"6".repeat(64)}`,
  releaseId: "release-search-next",
  sequence: 2,
} satisfies TestIdentity;
const find = makeFunctionReference<"query", SearchArgs, SearchResult>(
  "contentRelease/search:find"
);

/** Creates one native page request bound to an optional prior release page. */
function searchArgs(
  query: string,
  options?: {
    readonly cursor?: null | string;
    readonly identity?: TestIdentity;
    readonly numItems?: number;
  }
): SearchArgs {
  return {
    expectedManifestHash: options?.identity?.manifestHash ?? null,
    expectedReleaseId: options?.identity?.releaseId ?? null,
    family: "material",
    locale: "en",
    paginationOpts: {
      cursor: options?.cursor ?? null,
      maximumRowsRead: 32,
      numItems: options?.numItems ?? 8,
    },
    query,
  };
}

/** Inserts one active routed material plus its sole search entry. */
async function insertSearchEntry(
  ctx: MutationCtx,
  identity: TestIdentity,
  contentKey: string,
  plainText: string
) {
  const publicPath = `test/${contentKey.replace("test:", "")}`;
  const projectionJson = testProjectionJson({ contentKey, publicPath });
  await insertRuntimeVersion(ctx, "public", contentKey, {
    artifactHash: `sha256:${contentKey.padEnd(64, "0").slice(0, 64)}`,
    headReleaseId: identity.releaseId,
    headSequence: identity.sequence,
    plainText,
    projectionJson,
    publicPath,
  });
  await insertRuntimeBinding(ctx, contentKey, {
    bindingReleaseId: identity.releaseId,
    bindingSequence: identity.sequence,
    publicPath,
  });
  await insertRuntimeIndex(ctx, contentKey, {
    headSequence: identity.sequence,
    plainText,
  });
}

/** Advances both active content and its fully synchronized search identity. */
async function selectIdentity(ctx: MutationCtx, identity: TestIdentity) {
  const state = await ctx.db.query("contentState").unique();
  if (!state) {
    throw new Error("Expected content search state.");
  }
  await ctx.db.patch("contentState", state._id, {
    activeManifestHash: identity.manifestHash,
    activeReleaseId: identity.releaseId,
    activeSequence: identity.sequence,
    searchManifestHash: identity.manifestHash,
    searchReleaseId: identity.releaseId,
    searchSequence: identity.sequence,
  });
}

describe("contentRelease/search", () => {
  it("returns an empty terminal page before the first active release", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertTestState(ctx, { nextSequence: 1 }));

    await expect(t.query(find, searchArgs("anything"))).resolves.toEqual({
      activeManifestHash: null,
      activeReleaseId: null,
      result: { continueCursor: "", isDone: true, page: [] },
    });
  });

  it("returns complete active-only pages without historical empty scans", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertTestState(ctx, {
        active: BASE,
        nextSequence: 2,
        search: BASE,
      });
      for (let index = 0; index < 96; index += 1) {
        await insertSearchEntry(
          ctx,
          BASE,
          `test:scale-${index}`,
          "scalable needle"
        );
      }
    });

    const first = await t.query(find, searchArgs("needle", { numItems: 32 }));
    expect(first).toMatchObject({
      activeReleaseId: BASE.releaseId,
      result: { isDone: false, page: { length: 32 } },
    });
    const second = await t.query(
      find,
      searchArgs("needle", {
        cursor: first.result.continueCursor,
        identity: BASE,
        numItems: 32,
      })
    );
    expect(second.result.page).toHaveLength(32);
    expect(
      second.result.page.every(({ releaseId }) => releaseId === BASE.releaseId)
    ).toBe(true);
  });

  it("rejects a continuation cursor after active release replacement", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertTestState(ctx, {
        active: BASE,
        nextSequence: 3,
        search: BASE,
      });
      await insertSearchEntry(ctx, BASE, "test:first", "race needle");
      await insertSearchEntry(ctx, BASE, "test:second", "race needle");
    });
    const first = await t.query(find, searchArgs("needle", { numItems: 1 }));

    await t.mutation(async (ctx) => {
      await insertSearchEntry(ctx, NEXT, "test:first", "race needle");
      await insertSearchEntry(ctx, NEXT, "test:second", "race needle");
      await selectIdentity(ctx, NEXT);
    });

    await expect(
      t.query(
        find,
        searchArgs("needle", {
          cursor: first.result.continueCursor,
          identity: BASE,
          numItems: 1,
        })
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STALE_BASE" },
    });
    await expect(
      t.query(find, searchArgs("needle", { numItems: 1 }))
    ).resolves.toMatchObject({
      activeReleaseId: NEXT.releaseId,
      result: { page: [{ releaseId: NEXT.releaseId }] },
    });
  });

  it("fails closed while an activated release is still synchronizing", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertTestState(ctx, {
        active: BASE,
        nextSequence: 3,
        search: BASE,
      });
      await selectIdentity(ctx, NEXT);
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected active search state.");
      }
      await ctx.db.patch("contentState", state._id, {
        searchManifestHash: BASE.manifestHash,
        searchReleaseId: BASE.releaseId,
        searchSequence: BASE.sequence,
      });
    });

    await expect(t.query(find, searchArgs("needle"))).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
  });

  it("rejects invalid terms and unowned pagination controls", async () => {
    const t = convexTest(schema, convexModules);
    for (const query of [
      "   ",
      Array.from({ length: 17 }, (_, index) => `term${index}`).join(" "),
      "x".repeat(33),
    ]) {
      await expect(t.query(find, searchArgs(query))).rejects.toMatchObject({
        data: { code: "CONTENT_RELEASE_LIMIT" },
      });
    }
    const bounded = searchArgs("bounded");
    for (const paginationOpts of [
      { ...bounded.paginationOpts, endCursor: "external" },
      { ...bounded.paginationOpts, maximumBytesRead: 1024 },
    ]) {
      await expect(
        t.query(find, { ...bounded, paginationOpts })
      ).rejects.toMatchObject({
        data: { code: "CONTENT_RELEASE_LIMIT" },
      });
    }
  });
});
