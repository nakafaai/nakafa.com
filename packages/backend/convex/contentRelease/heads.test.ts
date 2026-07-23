import {
  type HeadPage,
  HeadPageSchema,
} from "@nakafa/aksara-contracts/release/head";
import {
  MAX_HEAD_PAGE_COUNT,
  MAX_PUBLICATION_RESPONSE_BYTES,
} from "@nakafa/aksara-contracts/transport/limits";
import { internal } from "@repo/backend/convex/_generated/api";
import { publicationSuccess } from "@repo/backend/convex/contentRelease/ingress/response";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  insertTestHead,
  maximumTestHead,
} from "@repo/backend/test/content-head";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content-release";
import { activateRollbackFixture } from "@repo/backend/test/content-rollback";
import {
  insertTestState,
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content-state";
import { getConvexSize } from "convex/values";
import { convexTest, type TestConvex } from "convex-test";
import { Effect, Either, Schema } from "effect";
import { describe, expect, it } from "vitest";

const headPage = internal.contentRelease.heads.page;
/** Requests one exact material directory page. */
function readPage(
  t: TestConvex<typeof schema>,
  cursor: null | string,
  identity: TestIdentity = {
    manifestHash: TEST_MANIFEST_HASH,
    releaseId: TEST_RELEASE_ID,
    sequence: 1,
  },
  limit = 2
): Promise<HeadPage> {
  return t.query(headPage, {
    activeManifestHash: identity.manifestHash,
    activeReleaseId: identity.releaseId,
    cursor,
    family: "material",
    limit,
  });
}

/** Selects the ordered content keys returned by one head page. */
function headKeys(page: HeadPage) {
  return page.heads.map(({ contentKey }) => contentKey);
}

describe("contentRelease/heads", () => {
  it("pages structurally shared material heads in canonical order", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await activateRollbackFixture(ctx, 0, 0);
      await insertTestHead(ctx, {
        contentKey: "test:zeta",
        releaseId: "release-prior",
        sequence: 0,
      });
      await insertTestHead(ctx, { contentKey: "test:beta" });
      await insertTestHead(ctx, { contentKey: "test:alpha" });
    });

    const first = await readPage(t, null);
    const second = await readPage(t, first.nextCursor);

    expect(first).toMatchObject({ cursor: null, done: false });
    expect(headKeys(first)).toEqual(["test:alpha", "test:beta"]);
    expect(second).toMatchObject({ done: true, nextCursor: null });
    expect(headKeys(second)).toEqual(["test:zeta"]);
  });

  it("reads an exact verified candidate against its completed base", async () => {
    const t = convexTest(schema, convexModules);
    const active = {
      manifestHash: `sha256:${"6".repeat(64)}`,
      releaseId: "release-base",
      sequence: 1,
    } satisfies TestIdentity;
    const candidate = {
      manifestHash: `sha256:${"7".repeat(64)}`,
      releaseId: "release-candidate",
      sequence: 2,
    } satisfies TestIdentity;
    await t.mutation(async (ctx) => {
      await insertZeroRelease(ctx, {
        ...active,
        role: "candidate",
        status: "completed",
      });
      await insertZeroRelease(ctx, {
        ...candidate,
        base: active,
        role: "candidate",
        status: "verified",
      });
      await insertTestState(ctx, {
        active,
        candidate,
        nextSequence: 3,
      });
      await insertTestHead(ctx, {
        contentKey: "test:candidate",
        releaseId: candidate.releaseId,
        sequence: candidate.sequence,
      });
    });

    await expect(readPage(t, null, candidate)).resolves.toMatchObject({
      activeReleaseId: candidate.releaseId,
      heads: [{ contentKey: "test:candidate" }],
    });
  });

  it("returns empty nonterminal pages while advancing the opaque cursor", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await activateRollbackFixture(ctx, 0, 0);
      await insertTestHead(ctx, {
        contentKey: "test:deleted",
        operation: "delete",
      });
      await insertTestHead(ctx, { contentKey: "test:visible" });
    });

    const first = await readPage(t, null, undefined, 1);
    const second = await readPage(t, first.nextCursor, undefined, 1);
    const third = await readPage(t, second.nextCursor, undefined, 1);
    expect(first).toMatchObject({ done: false, heads: [] });
    expect(first.nextCursor).not.toBeNull();
    expect(second).toMatchObject({ done: false });
    expect(headKeys(second)).toEqual(["test:visible"]);
    expect(second.nextCursor).not.toBeNull();
    expect(third).toMatchObject({ done: true, heads: [], nextCursor: null });
  });

  it("keeps the exact maximum head page below Convex and HTTP ceilings", () => {
    const page = Schema.decodeUnknownSync(HeadPageSchema)({
      activeManifestHash: `sha256:${"e".repeat(64)}`,
      activeReleaseId: "a".repeat(128),
      cursor: "c".repeat(4096),
      done: false,
      family: "material",
      heads: Array.from({ length: MAX_HEAD_PAGE_COUNT }, (_, index) =>
        maximumTestHead(index)
      ),
      nextCursor: "d".repeat(4096),
    });
    const encoded = Effect.runSync(
      publicationSuccess({ ok: true, operation: "headPage", value: page })
    );
    const convexPage = {
      ...page,
      heads: page.heads.map((head) => ({ ...head })),
    };

    expect(getConvexSize(convexPage)).toBeLessThan(
      MAX_PUBLICATION_RESPONSE_BYTES
    );
    expect(new TextEncoder().encode(encoded.body).byteLength).toBeLessThan(
      MAX_PUBLICATION_RESPONSE_BYTES
    );

    const overflow = Schema.decodeUnknownEither(HeadPageSchema)({
      ...page,
      heads: [...page.heads, maximumTestHead(MAX_HEAD_PAGE_COUNT)],
    });
    expect(Either.isLeft(overflow)).toBe(true);
  });

  it("rejects invalid limits and unreadable snapshot identities", async () => {
    const invalid = convexTest(schema, convexModules);
    await expect(readPage(invalid, null, undefined, 0)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });

    const stale = convexTest(schema, convexModules);
    await stale.mutation((ctx) => activateRollbackFixture(ctx, 0, 0));
    await expect(
      readPage(stale, null, {
        manifestHash: TEST_MANIFEST_HASH,
        releaseId: "release-other",
        sequence: 1,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_MISSING" } });
  });

  it("fails closed when a selected head loses canonical evidence", async () => {
    const incomplete = convexTest(schema, convexModules);
    await incomplete.mutation(async (ctx) => {
      await activateRollbackFixture(ctx, 0, 0);
      await insertTestHead(ctx, { contentKey: "test:broken" });
      const head = await ctx.db.query("contentHeads").unique();
      if (!head) {
        throw new Error("Expected material head.");
      }
      await ctx.db.patch("contentHeads", head._id, {
        compilerConfigHash: undefined,
      });
    });
    await expect(readPage(incomplete, null)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const route = convexTest(schema, convexModules);
    await route.mutation(async (ctx) => {
      await activateRollbackFixture(ctx, 0, 0);
      await insertTestHead(ctx, { contentKey: "test:route" });
      const binding = await ctx.db.query("contentBindings").unique();
      if (!binding) {
        throw new Error("Expected route binding.");
      }
      await ctx.db.delete("contentBindings", binding._id);
    });
    await expect(readPage(route, null)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_ROUTE" },
    });
  });
});
