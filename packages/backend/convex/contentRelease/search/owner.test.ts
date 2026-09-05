import { describe, expect, it } from "@effect/vitest";
import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { loadSearchOwner } from "@repo/backend/convex/contentRelease/search/owner";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { insertRuntimeArticles } from "@repo/backend/test/content/runtime";
import { TEST_RUNTIME_RELEASE } from "@repo/backend/test/runtime/values";

describe("active search publication ownership", () => {
  it("exposes the active search generation only after all identity fields synchronize", async () => {
    const t = createConvexTestWithBetterAuth();
    const read = () => t.query((ctx) => runConvexProgram(loadSearchOwner(ctx)));
    expect(await read()).toBeNull();
    await t.mutation((ctx) => insertRuntimeArticles(ctx, 1));
    const identity = {
      searchManifestHash: TEST_RUNTIME_RELEASE.manifestHash,
      searchReleaseId: TEST_RUNTIME_RELEASE.releaseId,
      searchSequence: TEST_RUNTIME_RELEASE.sequence,
    };
    const patches: readonly Partial<Doc<"contentState">>[] = [
      { searchManifestHash: undefined },
      { searchReleaseId: "previous-release" },
      { searchSequence: TEST_RUNTIME_RELEASE.sequence - 1 },
    ];
    for (const patch of patches) {
      await t.mutation(async (ctx) => {
        const state = await ctx.db.query("contentState").unique();
        if (!state) {
          return expect.fail("Expected an active publication state.");
        }
        await ctx.db.patch(state._id, { ...identity, ...patch });
      });
      await expect(read()).rejects.toMatchObject({
        data: {
          code: "CONTENT_RELEASE_STATE",
          message: `Search for active release ${TEST_RUNTIME_RELEASE.releaseId} is still synchronizing.`,
        },
      });
    }
    await t.mutation(async (ctx) => {
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        return expect.fail("Expected an active publication state.");
      }
      await ctx.db.patch(state._id, identity);
    });
    expect(await read()).toMatchObject({
      families: ContentFamilySchema.literals,
      manifestHash: TEST_RUNTIME_RELEASE.manifestHash,
      releaseId: TEST_RUNTIME_RELEASE.releaseId,
      sequence: TEST_RUNTIME_RELEASE.sequence,
    });
  });
});
