import { describe, expect, it } from "@effect/vitest";
import {
  validateActivationRenderer,
  validateCandidate,
  validateRecovery,
} from "@repo/backend/convex/contentRelease/activation/validate";
import { encodeRendererJson } from "@repo/backend/convex/contentRelease/wire";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  insertActivationPair,
  makeActivationPair,
} from "@repo/backend/test/content/activation";
import { TEST_PROOF_RENDERER } from "@repo/backend/test/content/proof";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("activation identity validation", () => {
  it.effect("rejects activation using another manifest identity", () =>
    Effect.gen(function* () {
      const { candidate, recovery } = makeActivationPair();
      const rendererJson = encodeRendererJson(TEST_PROOF_RENDERER);
      expect(
        yield* validateActivationRenderer(
          candidate.manifest.releaseId,
          JSON.stringify(candidate),
          rendererJson,
          rendererJson,
          recovery.manifestHash
        ).pipe(Effect.flip)
      ).toMatchObject({ code: "CONTENT_RELEASE_CONFLICT" });
    })
  );

  it("rejects a recovery whose frozen state changed after candidate verification", async () => {
    const t = convexTest(schema, convexModules);
    const { candidate, recovery } = makeActivationPair();
    await t.mutation((ctx) =>
      runConvexProgram(insertActivationPair(ctx, candidate, recovery))
    );
    await t.mutation(async (ctx) => {
      const row = await ctx.db
        .query("contentReleases")
        .withIndex("by_releaseId", (q) =>
          q.eq("releaseId", recovery.manifest.releaseId)
        )
        .unique();
      if (!row) {
        throw new Error("Expected the retained inverse.");
      }
      await ctx.db.patch("contentReleases", row._id, { status: "staging" });
    });
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          validateCandidate(
            ctx,
            candidate.manifest.releaseId,
            encodeRendererJson(TEST_PROOF_RENDERER),
            candidate.manifestHash
          )
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it("rejects recovery activation while a candidate still owns its publication slot", async () => {
    const t = convexTest(schema, convexModules);
    const { candidate, recovery } = makeActivationPair();
    await t.mutation((ctx) =>
      runConvexProgram(insertActivationPair(ctx, candidate, recovery))
    );
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          validateRecovery(
            ctx,
            recovery.manifest.releaseId,
            encodeRendererJson(TEST_PROOF_RENDERER),
            recovery.manifestHash
          )
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
  });
});
