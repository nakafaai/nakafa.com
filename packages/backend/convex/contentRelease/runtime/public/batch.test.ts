// @vitest-environment node

import { canonicalizeMaterialProjection } from "@nakafa/aksara-contracts/projection/material";
import { MAX_PUBLIC_RUNTIME_RESPONSE_BYTES } from "@nakafa/aksara-contracts/runtime/spec";
import { MAX_PUBLIC_RUNTIME_BATCH_REQUEST_BYTES } from "@repo/backend/content/batch";
import {
  dispatchBatchProgram,
  dispatchPredecessorBatchProgram,
} from "@repo/backend/convex/contentRelease/runtime/public/batch";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  makeMaterialProjection,
  testProjectionJson,
} from "@repo/backend/test/content-material";
import {
  insertRuntimeRelease,
  insertSignedRelease,
  publicRuntimeRequest,
  runtimeContentKey,
} from "@repo/backend/test/content-runtime";
import {
  insertRuntimeHead,
  insertSignedHead,
} from "@repo/backend/test/runtime-head";
import {
  loadRuntimeV150,
  verifyRuntimeV150,
} from "@repo/backend/test/runtime-v150";
import { TEST_RUNTIME_PATH } from "@repo/backend/test/runtime-values";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

type RuntimeTest = ReturnType<typeof createConvexTestWithBetterAuth>;
type RuntimeAction = Pick<RuntimeTest, "action">;

const foundRequest = JSON.parse(publicRuntimeRequest());
const missingRequest = {
  appLocale: "en",
  delivery: "public",
  publicPath: "test/missing",
};

/** Executes the bounded public batch transport program. */
function runDispatch(
  t: RuntimeAction,
  input: unknown,
  dispatch: typeof dispatchBatchProgram = dispatchBatchProgram
) {
  const source = typeof input === "string" ? input : JSON.stringify(input);
  const byteLength = new TextEncoder().encode(source).byteLength;
  return t.action((ctx) => runConvexProgram(dispatch(ctx, source, byteLength)));
}

/** Seeds one active public runtime route. */
function seedPublicRuntime(t: RuntimeTest) {
  return t.mutation(async (ctx) => {
    await insertRuntimeRelease(ctx);
    await insertRuntimeHead(ctx, "public", runtimeContentKey("public"));
  });
}

describe("contentRelease/runtime/public/batch", () => {
  it.each(["en", "id", "de"] as const)(
    "serves strict 0.15.0 and current %s material batches from one source",
    async (appLocale) => {
      const t = createConvexTestWithBetterAuth();
      const projection = makeMaterialProjection(appLocale, 1);
      const sourcePath = `packages/corpus/${projection.contentKey}/${projection.artifactLocale}.mdx`;
      await t.mutation(async (ctx) => {
        await insertSignedRelease(ctx);
        await insertSignedHead(ctx, "public", projection.contentKey, {
          artifactLocale: projection.artifactLocale,
          projectionJson: canonicalizeMaterialProjection(projection),
          publicPath: projection.publicPath,
          rendererDomain: "mathematics",
          sourcePath,
        });
      });
      const request = {
        appLocale,
        delivery: "public",
        publicPath: projection.publicPath,
      } as const;
      const missing = {
        ...request,
        publicPath: `${projection.parentPath}/missing`,
      };

      const [predecessor, current] = await Promise.all([
        runDispatch(
          t,
          { requests: [request, missing] },
          dispatchPredecessorBatchProgram
        ),
        runDispatch(t, { requests: [request, missing] }),
      ]);
      expect(predecessor.status).toBe(200);
      expect(current.status).toBe(200);
      const predecessorResponses = JSON.parse(predecessor.body).responses;
      const currentResponses = JSON.parse(current.body).responses;
      const verifiedFound = await verifyRuntimeV150(
        request,
        predecessorResponses[0]
      );
      const verifiedMissing = await verifyRuntimeV150(
        missing,
        predecessorResponses[1]
      );
      if (verifiedFound.response.kind !== "found") {
        throw new Error("Expected the predecessor batch to return content.");
      }

      expect(verifiedFound.verified).toMatchObject({ kind: "found" });
      expect(verifiedFound.response.projection.metadata).toMatchObject({
        date: projection.metadata.datePublished,
      });
      expect(verifiedFound.response.projectionHash).not.toBe(
        currentResponses[0].projectionHash
      );
      expect(verifiedFound.response.sourcePath).toBe(sourcePath);
      expect(verifiedFound.response.activeManifestHash).toBe(
        currentResponses[0].activeManifestHash
      );
      expect(verifiedFound.response.activeReleaseId).toBe(
        currentResponses[0].activeReleaseId
      );
      expect(verifiedMissing.verified).toEqual({ kind: "missing" });
      expect(currentResponses[0].projection.metadata).toMatchObject({
        datePublished: projection.metadata.datePublished,
      });
      expect(currentResponses[0].projection.metadata).not.toHaveProperty(
        "date"
      );

      const archive = await loadRuntimeV150();
      await expect(
        Effect.runPromise(
          archive.runtime.decodePublicContentRuntimeResponse(
            currentResponses[0]
          )
        )
      ).rejects.toBeDefined();
    }
  );

  it("keeps predecessor batch failures in the 0.15.0 contract", async () => {
    const result = await runDispatch(
      createConvexTestWithBetterAuth(),
      "{",
      dispatchPredecessorBatchProgram
    );
    const archive = await loadRuntimeV150();
    const failure = await Effect.runPromise(
      archive.runtime.decodePublicContentRuntimeResponse(
        JSON.parse(result.body)
      )
    );

    expect(result.status).toBe(400);
    expect(failure).toEqual({
      code: "CONTENT_RUNTIME_INVALID",
      kind: "failure",
    });
  });

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

  it("fails the complete batch when one stored row is corrupt", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedPublicRuntime(t);
    await t.mutation(async (ctx) => {
      const head = await ctx.db.query("contentHeads").unique();
      if (!head) {
        throw new Error("Expected one runtime head.");
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
