// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { MAX_PROTECTED_RUNTIME_REQUEST_BYTES } from "@nakafa/aksara-contracts/runtime/protected/limits";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { dispatchProgram } from "@repo/backend/convex/contentRelease/runtime/protected/dispatch";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { TEST_KEY_RESOLVER } from "@repo/backend/test/content/proof";
import { insertProtectedRuntime } from "@repo/backend/test/runtime/protected";
import { Effect } from "effect";

type RuntimeTest = ReturnType<typeof createConvexTestWithBetterAuth>;
type RuntimeAction = Pick<RuntimeTest, "action">;

/** Executes the protected runtime transport program. */
function runDispatch(t: RuntimeAction, source: string) {
  const byteLength = new TextEncoder().encode(source).byteLength;
  return t.action((ctx) =>
    runConvexProgram(
      dispatchProgram(ctx, source, byteLength).pipe(
        Effect.provideService(ContentVerificationKeyResolver, TEST_KEY_RESOLVER)
      )
    )
  );
}

describe("contentRelease/runtime/protected/dispatch", () => {
  it("authenticates an ordered question and answer batch", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation(insertProtectedRuntime);

    const result = await runDispatch(t, JSON.stringify(fixture.request));

    expect(result.status).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({
      items: [
        {
          artifact: {
            artifactHash: fixture.question.artifactHash,
            payload: { contentKey: fixture.question.contentKey },
          },
          delivery: "authenticated",
        },
        {
          artifact: {
            artifactHash: fixture.answer.artifactHash,
            payload: { contentKey: fixture.answer.contentKey },
          },
          delivery: "entitled",
        },
      ],
      bundle: {
        bundleHash: fixture.request.bundleHash,
        payload: { snapshot: { snapshotId: fixture.snapshotId } },
      },
      kind: "found",
    });
  });

  it("returns exact absence and rejects malformed request bytes", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation(insertProtectedRuntime);
    const missing = {
      ...fixture.request,
      selectors: [
        {
          ...fixture.question,
          artifactHash: `sha256:${"f".repeat(64)}`,
        },
      ],
    };
    const source = JSON.stringify(fixture.request);
    const mismatch = await t.action((ctx) =>
      runConvexProgram(
        dispatchProgram(ctx, source, 1).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            TEST_KEY_RESOLVER
          )
        )
      )
    );

    await expect(runDispatch(t, JSON.stringify(missing))).resolves.toEqual({
      body: '{"kind":"missing"}',
      status: 404,
    });
    await expect(runDispatch(t, "{")).resolves.toMatchObject({ status: 400 });
    expect(mismatch.status).toBe(400);
    await expect(
      runDispatch(t, "x".repeat(MAX_PROTECTED_RUNTIME_REQUEST_BYTES + 1))
    ).resolves.toMatchObject({ status: 400 });
  });

  it("fails closed when one retained artifact disappears", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation(insertProtectedRuntime);
    await t.mutation(async (ctx) => {
      const artifact = await ctx.db
        .query("contentArtifacts")
        .withIndex("by_artifactHash", (index) =>
          index.eq("artifactHash", fixture.answer.artifactHash)
        )
        .unique();
      if (!artifact) {
        throw new Error("Expected one protected artifact.");
      }
      await ctx.db.delete("contentArtifacts", artifact._id);
    });

    await expect(
      runDispatch(t, JSON.stringify(fixture.request))
    ).resolves.toEqual({
      body: '{"code":"CONTENT_RUNTIME_INTERNAL","kind":"failure"}',
      status: 500,
    });
  });
});
