// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { MAX_PROTECTED_RUNTIME_REQUEST_BYTES } from "@nakafa/aksara-contracts/runtime/protected/limits";
import { dispatchProgram } from "@repo/backend/convex/contentRelease/runtime/history/dispatch";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { insertRetainedRuntime } from "@repo/backend/test/runtime/retained";

type RuntimeTest = ReturnType<typeof createConvexTestWithBetterAuth>;

/** Executes the retained attempt transport program. */
function runDispatch(t: Pick<RuntimeTest, "action">, source: string) {
  const byteLength = new TextEncoder().encode(source).byteLength;
  return t.action((ctx) =>
    runConvexProgram(dispatchProgram(ctx, source, byteLength, "current"))
  );
}

describe("contentRelease/runtime/history/dispatch", () => {
  it("returns one attempt-bound historical body", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation(insertRetainedRuntime);

    const result = await runDispatch(t, JSON.stringify(fixture.request));

    expect(result.status).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({
      appLocale: fixture.request.appLocale,
      attemptId: fixture.request.attemptId,
      items: [{ delivery: "authenticated" }],
      kind: "found",
      snapshotId: fixture.request.snapshotId,
    });
  });

  it("binds absence and internal failure to the decoded attempt", async () => {
    const missingTest = createConvexTestWithBetterAuth();
    const missingFixture = await missingTest.mutation(insertRetainedRuntime);
    await missingTest.mutation(async (ctx) => {
      const marker = await ctx.db.query("tryoutAttemptHistory").unique();
      if (!marker) {
        throw new Error("Expected retained attempt marker.");
      }
      await ctx.db.delete("tryoutAttemptHistory", marker._id);
    });

    await expect(
      runDispatch(missingTest, JSON.stringify(missingFixture.request))
    ).resolves.toEqual({
      body: JSON.stringify({
        appLocale: missingFixture.request.appLocale,
        attemptId: missingFixture.request.attemptId,
        kind: "missing",
      }),
      status: 404,
    });

    const damagedTest = createConvexTestWithBetterAuth();
    const damagedFixture = await damagedTest.mutation(insertRetainedRuntime);
    await damagedTest.mutation(async (ctx) => {
      const artifact = await ctx.db
        .query("contentArtifacts")
        .withIndex("by_artifactHash", (index) =>
          index.eq(
            "artifactHash",
            damagedFixture.request.selectors[0]?.artifactHash ?? ""
          )
        )
        .unique();
      if (!artifact) {
        throw new Error("Expected retained artifact.");
      }
      await ctx.db.patch("contentArtifacts", artifact._id, {
        artifactJson: "{}",
      });
    });
    const damaged = await runDispatch(
      damagedTest,
      JSON.stringify(damagedFixture.request)
    );
    expect(damaged.status).toBe(500);
    expect(JSON.parse(damaged.body)).toEqual({
      appLocale: damagedFixture.request.appLocale,
      attemptId: damagedFixture.request.attemptId,
      code: "CONTENT_RUNTIME_INTERNAL",
      kind: "failure",
    });
  });

  it("rejects malformed and oversized bytes before any history read", async () => {
    const t = createConvexTestWithBetterAuth();

    await expect(runDispatch(t, "{")).resolves.toMatchObject({ status: 400 });
    await expect(
      runDispatch(t, "x".repeat(MAX_PROTECTED_RUNTIME_REQUEST_BYTES + 1))
    ).resolves.toMatchObject({ status: 400 });
    const mismatch = await t.action((ctx) =>
      runConvexProgram(dispatchProgram(ctx, "{}", 1, "current"))
    );
    expect(mismatch.status).toBe(400);
  });
});
