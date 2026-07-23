import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testProofRenderer } from "@repo/backend/test/content-proof";
import {
  insertRuntimeRelease,
  TEST_RUNTIME_RELEASE,
} from "@repo/backend/test/content-runtime";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const readActive = api.contentRelease.runtime.active.read;

describe("contentRelease/runtime/active", () => {
  it("distinguishes an empty publication from one complete active identity", async () => {
    const empty = convexTest(schema, convexModules);
    await expect(empty.query(readActive, {})).resolves.toBeNull();

    const active = convexTest(schema, convexModules);
    await active.mutation((ctx) => insertRuntimeRelease(ctx));
    await expect(active.query(readActive, {})).resolves.toMatchObject({
      manifestHash: TEST_RUNTIME_RELEASE.manifestHash,
      releaseId: TEST_RUNTIME_RELEASE.releaseId,
      sequence: TEST_RUNTIME_RELEASE.sequence,
    });
  });

  it("fails visibly when active state or release identity is partial", async () => {
    const partial = convexTest(schema, convexModules);
    await partial.mutation((ctx) =>
      ctx.db.insert("contentState", {
        activeReleaseId: TEST_RUNTIME_RELEASE.releaseId,
        key: "primary",
        nextSequence: 4,
        updatedAt: 1,
      })
    );
    await expect(partial.query(readActive, {})).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const mismatch = convexTest(schema, convexModules);
    await mismatch.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      const release = await ctx.db.query("contentReleases").unique();
      if (!release) {
        throw new Error("Expected an active release.");
      }
      await ctx.db.patch("contentReleases", release._id, { sequence: 2 });
    });
    await expect(mismatch.query(readActive, {})).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const rendererMismatch = convexTest(schema, convexModules);
    await rendererMismatch.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      const release = await ctx.db.query("contentReleases").unique();
      if (!release) {
        throw new Error("Expected an active release.");
      }
      await ctx.db.patch("contentReleases", release._id, {
        rendererJson: JSON.stringify(testProofRenderer("blockquote")),
      });
    });
    await expect(rendererMismatch.query(readActive, {})).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
