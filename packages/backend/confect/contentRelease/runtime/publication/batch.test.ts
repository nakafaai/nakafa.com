import { RegisteredFunction } from "@confect/server";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { Array as Arr, Effect } from "effect";
// @vitest-environment node

import { afterEach, describe, expect, it } from "@effect/vitest";
import { MAX_PUBLIC_RUNTIME_RESPONSE_BYTES } from "@nakafa/aksara-contracts/runtime/spec";
import { dispatchBatchProgram } from "@repo/backend/confect/contentRelease/runtime/publication/batch";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { MAX_PUBLIC_RUNTIME_BATCH_REQUEST_BYTES } from "@repo/backend/content/batch";
import { internal } from "@repo/backend/convex/_generated/api";
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
afterEach(() => vi.restoreAllMocks());

/** Executes the bounded public batch transport program. */
function runDispatch(t: RuntimeAction, input: unknown) {
  const source = typeof input === "string" ? input : JSON.stringify(input);
  const byteLength = new TextEncoder().encode(source).byteLength;
  return t.action((ctx) =>
    Effect.runPromise(
      dispatchBatchProgram(source, byteLength).pipe(
        Effect.provide(RegisteredFunction.actionLayer(confectSchema, ctx))
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
describe("contentRelease/runtime/publication/batch", () => {
  it("returns eight ordered exact responses from one batch read", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedPublicRuntime(t);
    const requests = [
      foundRequest,
      missingRequest,
      ...Array.from(
        {
          length: 6,
        },
        () => foundRequest
      ),
    ];
    const result = await runDispatch(t, {
      requests,
    });
    expect(result.status).toBe(200);
    const responses = JSON.parse(result.body).responses;
    expect(responses).toHaveLength(8);
    expect(
      Arr.map<readonly { kind: string }[], string>(
        responses,
        ({ kind }) => kind
      )
    ).toEqual([
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
      artifact: {
        payload: {
          contentKey: runtimeContentKey("public"),
        },
      },
      projection: {
        publicPath: TEST_RUNTIME_PATH,
      },
    });
  });
  it("rejects empty, nine-item, malformed, and mismatched request bytes", async () => {
    const t = createConvexTestWithBetterAuth();
    const source = JSON.stringify({
      requests: [foundRequest],
    });
    const mismatch = await t.action((ctx) =>
      Effect.runPromise(
        dispatchBatchProgram(source, 1).pipe(
          Effect.provide(RegisteredFunction.actionLayer(confectSchema, ctx))
        )
      )
    );
    await expect(
      runDispatch(t, {
        requests: [],
      })
    ).resolves.toMatchObject({
      status: 400,
    });
    await expect(
      runDispatch(t, {
        requests: Array.from(
          {
            length: 9,
          },
          () => foundRequest
        ),
      })
    ).resolves.toMatchObject({
      status: 400,
    });
    await expect(runDispatch(t, "{")).resolves.toMatchObject({
      status: 400,
    });
    await expect(
      runDispatch(t, "x".repeat(MAX_PUBLIC_RUNTIME_BATCH_REQUEST_BYTES + 1))
    ).resolves.toMatchObject({
      status: 400,
    });
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
    await expect(
      runDispatch(t, {
        requests: [foundRequest],
      })
    ).resolves.toEqual({
      body: '{"code":"CONTENT_RUNTIME_RESPONSE_TOO_LARGE","kind":"failure"}',
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
      runDispatch(t, {
        requests: [foundRequest, missingRequest],
      })
    ).resolves.toEqual({
      body: '{"code":"CONTENT_RUNTIME_INTERNAL","kind":"failure"}',
      status: 500,
    });
  });
  it("rejects corrupt artifact JSON after the stored route has been authenticated", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedPublicRuntime(t);
    await t.mutation(async (ctx) => {
      const artifact = await ctx.db.query("contentArtifacts").unique();
      if (!artifact) {
        return expect.fail("Expected one runtime artifact.");
      }
      await ctx.db.patch(artifact._id, {
        artifactJson: "{}",
      });
    });
    await expect(
      runDispatch(t, {
        requests: [foundRequest],
      })
    ).resolves.toEqual({
      body: '{"code":"CONTENT_RUNTIME_INTERNAL","kind":"failure"}',
      status: 500,
    });
  });
  it("rejects a transport response whose cardinality differs from its request", async () => {
    const t = createConvexTestWithBetterAuth();
    const source = JSON.stringify({
      requests: [foundRequest],
    });
    const result = await t.action((ctx) => {
      vi.spyOn(ctx, "runQuery").mockResolvedValueOnce([]);
      return Effect.runPromise(
        dispatchBatchProgram(
          source,
          new TextEncoder().encode(source).byteLength
        ).pipe(
          Effect.provide(RegisteredFunction.actionLayer(confectSchema, ctx))
        )
      );
    });
    expect(result).toEqual({
      body: '{"code":"CONTENT_RUNTIME_INTERNAL","kind":"failure"}',
      status: 500,
    });
  });
  it("returns an internal failure when Node cannot hash an authenticated query result", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedPublicRuntime(t);
    const source = JSON.stringify({
      requests: [foundRequest],
    });
    const result = await t.action(async (ctx) => {
      const rows = await ctx.runQuery(
        internal.contentRelease.runtime.publication.internal.readBatch,
        {
          requests: [
            {
              appLocale: "en",
              publicPath: TEST_RUNTIME_PATH,
            },
          ],
        }
      );
      vi.spyOn(ctx, "runQuery").mockResolvedValueOnce(rows);
      vi.spyOn(crypto.subtle, "digest").mockRejectedValueOnce(
        new Error("Hash service unavailable.")
      );
      return Effect.runPromise(
        dispatchBatchProgram(
          source,
          new TextEncoder().encode(source).byteLength
        ).pipe(
          Effect.provide(RegisteredFunction.actionLayer(confectSchema, ctx))
        )
      );
    });
    expect(result).toEqual({
      body: '{"code":"CONTENT_RUNTIME_INTERNAL","kind":"failure"}',
      status: 500,
    });
  });
  it.each(["invalid", "rejected"])(
    "sanitizes a %s query response at the action boundary",
    async (failure) => {
      const t = createConvexTestWithBetterAuth();
      const source = JSON.stringify({
        requests: [foundRequest],
      });
      const result = await t.action((ctx) => {
        const query = vi.spyOn(ctx, "runQuery");
        if (failure === "invalid") {
          query.mockResolvedValueOnce({
            private: "transport corruption",
          });
        } else {
          query.mockRejectedValueOnce(new Error("private transport failure"));
        }
        return Effect.runPromise(
          dispatchBatchProgram(
            source,
            new TextEncoder().encode(source).byteLength
          ).pipe(
            Effect.provide(RegisteredFunction.actionLayer(confectSchema, ctx))
          )
        );
      });
      expect(result).toEqual({
        body: '{"code":"CONTENT_RUNTIME_INTERNAL","kind":"failure"}',
        status: 500,
      });
    }
  );
});
