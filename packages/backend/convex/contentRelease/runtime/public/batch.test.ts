// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { MAX_PUBLIC_RUNTIME_RESPONSE_BYTES } from "@nakafa/aksara-contracts/runtime/spec";
import { MAX_PUBLIC_RUNTIME_BATCH_REQUEST_BYTES } from "@repo/backend/content/batch";
import { dispatchBatchProgram } from "@repo/backend/convex/contentRelease/runtime/public/batch";
import type { PublicRuntimeRow } from "@repo/backend/convex/contentRelease/runtime/public/internal";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { testProjectionJson } from "@repo/backend/test/content/material";
import {
  insertRuntimeRelease,
  publicRuntimeRequest,
  runtimeContentKey,
} from "@repo/backend/test/content/runtime";
import { insertRuntimeHead } from "@repo/backend/test/runtime/head";
import { TEST_RUNTIME_PATH } from "@repo/backend/test/runtime/values";

type RuntimeTest = ReturnType<typeof createConvexTestWithBetterAuth>;
type RuntimeAction = Pick<RuntimeTest, "action">;

const foundRequest = JSON.parse(publicRuntimeRequest());
const missingRequest = {
  appLocale: "en",
  delivery: "public",
  publicPath: "test/missing",
};

/** Executes the bounded public batch transport program. */
function runDispatch(t: RuntimeAction, input: unknown) {
  const source = typeof input === "string" ? input : JSON.stringify(input);
  const byteLength = new TextEncoder().encode(source).byteLength;
  return t.action((ctx) =>
    runConvexProgram(dispatchBatchProgram(ctx, source, byteLength))
  );
}

/** Executes the transport against an explicit internal query result. */
function runDispatchWithRows(
  t: RuntimeAction,
  input: unknown,
  rows: readonly PublicRuntimeRow[]
) {
  const source = JSON.stringify(input);
  const byteLength = new TextEncoder().encode(source).byteLength;
  return t.action((ctx) =>
    runConvexProgram(
      dispatchBatchProgram(
        new Proxy(ctx, {
          get: (target, property, receiver) =>
            property === "runQuery"
              ? () => Promise.resolve(rows)
              : Reflect.get(target, property, receiver),
        }),
        source,
        byteLength
      )
    )
  );
}

/** Seeds one active public runtime route. */
function seedPublicRuntime(t: RuntimeTest) {
  return t.mutation(async (ctx) => {
    await insertRuntimeRelease(ctx);
    await insertRuntimeHead(ctx, "public", runtimeContentKey("public"));
  });
}

describe("contentRelease/runtime/public/batch", () => {
  it("returns eight ordered exact responses from one batch read", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedPublicRuntime(t);
    const requests = [
      foundRequest,
      missingRequest,
      ...Array.from({ length: 6 }, () => foundRequest),
    ];

    const result = await runDispatch(t, { requests });

    expect(result.status).toBe(200);
    const responses = JSON.parse(result.body).responses;
    expect(responses).toHaveLength(8);
    expect(responses.map(({ kind }: { kind: string }) => kind)).toEqual([
      "found",
      "missing",
      "found",
      "found",
      "found",
      "found",
      "found",
      "found",
    ]);
    expect(responses[0]).toMatchObject({
      artifact: { payload: { contentKey: runtimeContentKey("public") } },
      projection: { publicPath: TEST_RUNTIME_PATH },
    });
  });

  it("rejects empty, nine-item, malformed, and mismatched request bytes", async () => {
    const t = createConvexTestWithBetterAuth();
    const source = JSON.stringify({ requests: [foundRequest] });
    const mismatch = await t.action((ctx) =>
      runConvexProgram(dispatchBatchProgram(ctx, source, 1))
    );

    await expect(runDispatch(t, { requests: [] })).resolves.toMatchObject({
      status: 400,
    });
    await expect(
      runDispatch(t, {
        requests: Array.from({ length: 9 }, () => foundRequest),
      })
    ).resolves.toMatchObject({ status: 400 });
    await expect(runDispatch(t, "{")).resolves.toMatchObject({ status: 400 });
    await expect(
      runDispatch(t, "x".repeat(MAX_PUBLIC_RUNTIME_BATCH_REQUEST_BYTES + 1))
    ).resolves.toMatchObject({ status: 400 });
    expect(mismatch.status).toBe(400);
  });

  it("returns the exact too-large failure when one item exceeds 1 MiB", async () => {
    const t = createConvexTestWithBetterAuth();
    await t.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await insertRuntimeHead(ctx, "public", runtimeContentKey("public"), {
        compiledCode: "x".repeat(MAX_PUBLIC_RUNTIME_RESPONSE_BYTES / 2 + 1),
        projectionJson: testProjectionJson({
          contentKey: runtimeContentKey("public"),
          publicPath: TEST_RUNTIME_PATH,
          title: "x".repeat(MAX_PUBLIC_RUNTIME_RESPONSE_BYTES / 2 + 1),
        }),
      });
    });

    await expect(runDispatch(t, { requests: [foundRequest] })).resolves.toEqual(
      {
        body: '{"code":"CONTENT_RUNTIME_RESPONSE_TOO_LARGE","kind":"failure"}',
        status: 500,
      }
    );
  });

  it("rejects incomplete and undecodable internal query results", async () => {
    const t = createConvexTestWithBetterAuth();
    const corruptRow = {
      activeManifestHash: "sha256:test",
      activeReleaseId: "test-release",
      artifactJson: "{",
      delivery: "public",
      projectionHash: "sha256:test",
      projectionJson: "{}",
      releaseJson: "{}",
      rendererJson: "{}",
      sourcePath: "packages/corpus/material/lesson/test",
    } satisfies NonNullable<PublicRuntimeRow>;

    await expect(
      runDispatchWithRows(t, { requests: [foundRequest] }, [])
    ).resolves.toEqual({
      body: '{"code":"CONTENT_RUNTIME_INTERNAL","kind":"failure"}',
      status: 500,
    });
    await expect(
      runDispatchWithRows(t, { requests: [foundRequest] }, [corruptRow])
    ).resolves.toEqual({
      body: '{"code":"CONTENT_RUNTIME_INTERNAL","kind":"failure"}',
      status: 500,
    });
  });

  it("fails the complete batch when one stored row is corrupt", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedPublicRuntime(t);
    await t.mutation(async (ctx) => {
      const head = await ctx.db.query("contentHeads").unique();
      if (!head) {
        return expect.fail("Expected one runtime head.");
      }
      await ctx.db.patch("contentHeads", head._id, {
        projectionHash: `sha256:${"f".repeat(64)}`,
      });
    });

    await expect(
      runDispatch(t, { requests: [foundRequest, missingRequest] })
    ).resolves.toEqual({
      body: '{"code":"CONTENT_RUNTIME_INTERNAL","kind":"failure"}',
      status: 500,
    });
  });
});
