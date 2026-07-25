import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  testProjectionJson,
  testRendererJson,
} from "@repo/backend/test/content-release";
import {
  insertRuntimeRelease,
  TEST_RUNTIME_RELEASE,
} from "@repo/backend/test/content-runtime";
import {
  insertTestState,
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content-state";
import {
  insertRuntimeBinding,
  insertRuntimeHead,
  insertRuntimeKey,
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

interface PageArgs extends Record<string, Value> {
  readonly family: "material";
  readonly locale: "en";
  readonly paginationOpts: {
    readonly cursor: null | string;
    readonly maximumBytesRead: number;
    readonly maximumRowsRead: number;
    readonly numItems: number;
  };
}

interface PageResult {
  readonly activeManifestHash: null | string;
  readonly activeReleaseId: null | string;
  readonly result: PaginationResult<ProjectionRow>;
}

const CANDIDATE = {
  manifestHash: `sha256:${"6".repeat(64)}`,
  releaseId: "release-page-candidate",
  sequence: 1,
} satisfies TestIdentity;
const RECOVERY = {
  manifestHash: `sha256:${"7".repeat(64)}`,
  releaseId: "release-page-recovery",
  sequence: 2,
} satisfies TestIdentity;
const read = makeFunctionReference<"query", PageArgs, PageResult>(
  "contentRelease/page:read"
);
const activate = internal.contentRelease.activate.activate;

/** Creates the exact bounded page input used by public catalog reads. */
function pageArgs(cursor: null | string, numItems = 8): PageArgs {
  return {
    family: "material",
    locale: "en",
    paginationOpts: {
      cursor,
      maximumBytesRead: 1024 * 1024,
      maximumRowsRead: numItems,
      numItems,
    },
  };
}

describe("contentRelease/page", () => {
  it("keeps a candidate invisible until atomic pointer activation", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertZeroRelease(ctx, {
        ...CANDIDATE,
        role: "candidate",
        status: "verified",
      });
      await insertZeroRelease(ctx, {
        ...RECOVERY,
        base: CANDIDATE,
        originReleaseId: CANDIDATE.releaseId,
        role: "recovery",
        status: "verified",
      });
      await insertTestState(ctx, {
        candidate: CANDIDATE,
        nextSequence: 3,
        recovery: RECOVERY,
      });
      await insertRuntimeKey(ctx, "test:candidate", {
        headSequence: CANDIDATE.sequence,
      });
      await insertRuntimeHead(ctx, "public", "test:candidate", {
        bindingReleaseId: CANDIDATE.releaseId,
        bindingSequence: CANDIDATE.sequence,
        headReleaseId: CANDIDATE.releaseId,
        headSequence: CANDIDATE.sequence,
      });
    });

    await expect(t.query(read, pageArgs(null))).resolves.toMatchObject({
      activeReleaseId: null,
      result: { page: [] },
    });
    await t.mutation(activate, {
      manifestHash: CANDIDATE.manifestHash,
      releaseId: CANDIDATE.releaseId,
      rendererJson: testRendererJson(),
    });
    await expect(t.query(read, pageArgs(null))).resolves.toMatchObject({
      activeReleaseId: CANDIDATE.releaseId,
      result: {
        page: [
          {
            contentKey: "test:candidate",
            publicPath: "test/runtime",
            releaseId: CANDIDATE.releaseId,
          },
        ],
      },
    });
  });

  it("continues bounded permanent-key pagination without catalog copies", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      for (const [index, contentKey] of [
        "test:first",
        "test:second",
      ].entries()) {
        const publicPath = `test/page-${index}`;
        const projectionJson = testProjectionJson({ contentKey, publicPath });
        await insertRuntimeKey(ctx, contentKey, { projectionJson });
        await insertRuntimeHead(ctx, "public", contentKey, {
          artifactHash: `sha256:${String(index + 4).repeat(64)}`,
          projectionJson,
          publicPath,
        });
      }
    });

    const first = await t.query(read, pageArgs(null, 1));
    const second = await t.query(
      read,
      pageArgs(first.result.continueCursor, 1)
    );
    const terminal = await t.query(
      read,
      pageArgs(second.result.continueCursor, 1)
    );

    expect(first.result.page).toHaveLength(1);
    expect(second.result.page).toHaveLength(1);
    expect([
      first.result.page[0]?.contentKey,
      second.result.page[0]?.contentKey,
    ]).toEqual(["test:first", "test:second"]);
    expect(second.result.isDone).toBe(false);
    expect(terminal.result).toMatchObject({ isDone: true, page: [] });
  });

  it("projects a rename and filters an active tombstone", async () => {
    const renamed = convexTest(schema, convexModules);
    await renamed.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      const contentKey = "test:renamed";
      const oldPath = "test/old";
      const newPath = "test/new";
      await insertRuntimeKey(ctx, contentKey, { headSequence: 1 });
      await insertRuntimeVersion(ctx, "public", contentKey, {
        headReleaseId: "release-old",
        headSequence: 1,
        projectionJson: testProjectionJson({
          contentKey,
          publicPath: oldPath,
        }),
        publicPath: oldPath,
      });
      await insertRuntimeBinding(ctx, contentKey, {
        bindingReleaseId: "release-old",
        bindingSequence: 1,
        publicPath: oldPath,
      });
      await insertRuntimeVersion(ctx, "public", contentKey, {
        projectionJson: testProjectionJson({
          contentKey,
          publicPath: newPath,
        }),
        publicPath: newPath,
      });
      await insertRuntimeBinding(ctx, null, { publicPath: oldPath });
      await insertRuntimeBinding(ctx, contentKey, { publicPath: newPath });
    });
    await expect(renamed.query(read, pageArgs(null))).resolves.toMatchObject({
      result: { page: [{ publicPath: "test/new" }] },
    });

    const deleted = convexTest(schema, convexModules);
    await deleted.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await insertRuntimeKey(ctx, "test:deleted", { headSequence: 1 });
      await ctx.db.insert("contentHeads", {
        contentKey: "test:deleted",
        family: "material",
        index: 0,
        locale: "en",
        operation: "delete",
        releaseId: TEST_RUNTIME_RELEASE.releaseId,
        sequence: TEST_RUNTIME_RELEASE.sequence,
      });
    });
    await expect(deleted.query(read, pageArgs(null))).resolves.toMatchObject({
      result: { page: [] },
    });
  });
});
