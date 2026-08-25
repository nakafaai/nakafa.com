// @vitest-environment node

import { canonicalizeArticleProjection } from "@nakafa/aksara-contracts/projection/article";
import {
  decodePublicContentRuntimeRequest,
  MAX_PUBLIC_RUNTIME_REQUEST_BYTES,
} from "@nakafa/aksara-contracts/runtime/spec";
import { verifyContentRuntimeExchange } from "@nakafa/aksara-contracts/runtime/verify";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { internal } from "@repo/backend/convex/_generated/api";
import {
  dispatchPredecessorProgram,
  dispatchProgram,
} from "@repo/backend/convex/contentRelease/runtime/public/dispatch";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  FUNCTION_MATERIAL_JSON,
  FUNCTION_MATERIAL_KEY,
  FUNCTION_MATERIAL_PATH,
  FUNCTION_MATERIAL_SOURCE,
} from "@repo/backend/test/content-material";
import {
  TEST_PAGE_KEY,
  TEST_PAGE_PATH,
  TEST_PAGE_PROJECTION_JSON,
  TEST_PAGE_SOURCE,
} from "@repo/backend/test/content-page";
import { TEST_KEY_RESOLVER } from "@repo/backend/test/content-proof";
import { testTextHash } from "@repo/backend/test/content-release";
import {
  articleRuntimeRequest,
  insertSignedRelease,
  publicRuntimeRequest,
  runtimeContentKey,
  TEST_ARTICLE_KEY,
  TEST_ARTICLE_PATH,
  TEST_ARTICLE_PROJECTION_JSON,
  TEST_ARTICLE_SOURCE,
  testLocalizedArticleProjection,
} from "@repo/backend/test/content-runtime";
import { insertSignedHead } from "@repo/backend/test/runtime-head";
import {
  loadRuntimeV150,
  verifyRuntimeV150,
} from "@repo/backend/test/runtime-v150";
import { TEST_RUNTIME_PATH } from "@repo/backend/test/runtime-values";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";

type RuntimeTest = ReturnType<typeof createConvexTestWithBetterAuth>;
type RuntimeAction = Pick<RuntimeTest, "action">;
/** Executes the public runtime transport program. */
function runDispatch(
  t: RuntimeAction,
  source: string,
  dispatch: typeof dispatchProgram = dispatchProgram
) {
  const byteLength = new TextEncoder().encode(source).byteLength;
  return t.action((ctx) => runConvexProgram(dispatch(ctx, source, byteLength)));
}
/** Seeds one active route for the requested stored delivery class. */
function seedSigned(
  t: RuntimeTest,
  delivery: "authenticated" | "entitled" | "public"
) {
  return t.mutation(async (ctx) => {
    await insertSignedRelease(ctx);
    await insertSignedHead(ctx, delivery, runtimeContentKey(delivery));
  });
}
describe("contentRelease/runtime/public/dispatch", () => {
  it.each(["en", "id", "de"] as const)(
    "serves strict 0.15.0 and current %s article contracts from one source",
    async (appLocale) => {
      const t = createConvexTestWithBetterAuth();
      const projection = testLocalizedArticleProjection(0, appLocale);
      const sourcePath = `packages/corpus/articles/${projection.category}/article/0/${appLocale}.mdx`;
      await t.mutation(async (ctx) => {
        await insertSignedRelease(ctx);
        await insertSignedHead(ctx, "public", projection.contentKey, {
          artifactLocale: projection.artifactLocale,
          projectionJson: canonicalizeArticleProjection(projection),
          publicPath: projection.publicPath,
          rendererDomain: "politics",
          sourcePath,
        });
      });
      const request = JSON.stringify({
        appLocale,
        delivery: "public",
        publicPath: projection.publicPath,
      });

      const [predecessor, current] = await Promise.all([
        runDispatch(t, request, dispatchPredecessorProgram),
        runDispatch(t, request),
      ]);
      expect(predecessor.status).toBe(200);
      expect(current.status).toBe(200);
      const predecessorBody = JSON.parse(predecessor.body);
      const currentBody = JSON.parse(current.body);
      const verified = await verifyRuntimeV150(
        JSON.parse(request),
        predecessorBody
      );
      const currentRequest = await Effect.runPromise(
        decodePublicContentRuntimeRequest(JSON.parse(request))
      );
      const currentVerified = await Effect.runPromise(
        verifyContentRuntimeExchange({
          rendererManifest: currentBody.rendererManifest,
          request: currentRequest,
          response: currentBody,
        }).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            TEST_KEY_RESOLVER
          )
        )
      );
      if (verified.response.kind !== "found") {
        throw new Error("Expected the predecessor runtime to return content.");
      }

      expect(verified.verified).toMatchObject({ kind: "found" });
      expect(currentVerified).toMatchObject({ kind: "found" });
      expect(verified.response.projection.metadata).toMatchObject({
        date: projection.metadata.datePublished,
      });
      expect(verified.response.projection.metadata).not.toHaveProperty(
        "datePublished"
      );
      expect(verified.response.projectionHash).not.toBe(
        currentBody.projectionHash
      );
      expect(verified.response.sourcePath).toBe(sourcePath);
      expect(verified.response.activeManifestHash).toBe(
        currentBody.activeManifestHash
      );
      expect(verified.response.activeReleaseId).toBe(
        currentBody.activeReleaseId
      );
      expect(currentBody.projection.metadata).toMatchObject({
        datePublished: projection.metadata.datePublished,
      });
      expect(currentBody.projection.metadata).not.toHaveProperty("date");

      const archive = await loadRuntimeV150();
      await expect(
        Effect.runPromise(
          archive.runtime.decodePublicContentRuntimeResponse(currentBody)
        )
      ).rejects.toBeDefined();
    }
  );

  it("keeps predecessor missing and failure responses in the 0.15.0 contract", async () => {
    const t = createConvexTestWithBetterAuth();
    const missingRequest = {
      appLocale: "en",
      delivery: "public",
      publicPath: "subjects/test/missing",
    } as const;
    const [missing, failure] = await Promise.all([
      runDispatch(
        t,
        JSON.stringify(missingRequest),
        dispatchPredecessorProgram
      ),
      runDispatch(t, "{", dispatchPredecessorProgram),
    ]);
    const verifiedMissing = await verifyRuntimeV150(
      missingRequest,
      JSON.parse(missing.body)
    );
    const archive = await loadRuntimeV150();
    const decodedFailure = await Effect.runPromise(
      archive.runtime.decodePublicContentRuntimeResponse(
        JSON.parse(failure.body)
      )
    );

    expect(missing.status).toBe(404);
    expect(verifiedMissing.verified).toEqual({ kind: "missing" });
    expect(failure.status).toBe(400);
    expect(decodedFailure).toEqual({
      code: "CONTENT_RUNTIME_INVALID",
      kind: "failure",
    });
  });

  it.live(
    "returns one fully authenticated public artifact and exact absence",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        yield* Effect.promise(() => seedSigned(t, "public"));
        const row = yield* Effect.promise(() =>
          t.query(internal.contentRelease.runtime.public.internal.read, {
            appLocale: "en",
            publicPath: TEST_RUNTIME_PATH,
          })
        );
        if (!row) {
          throw new Error("Expected one signed runtime row.");
        }
        const request = yield* decodePublicContentRuntimeRequest(
          JSON.parse(publicRuntimeRequest())
        );
        const verified = yield* verifyContentRuntimeExchange({
          rendererManifest: JSON.parse(row.rendererJson),
          request,
          response: {
            activeManifestHash: row.activeManifestHash,
            activeReleaseId: row.activeReleaseId,
            artifact: JSON.parse(row.artifactJson),
            delivery: row.delivery,
            kind: "found",
            projection: JSON.parse(row.projectionJson),
            projectionHash: row.projectionHash,
            release: JSON.parse(row.releaseJson),
            rendererManifest: JSON.parse(row.rendererJson),
            sourcePath: row.sourcePath,
          },
        }).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            TEST_KEY_RESOLVER
          ),
          Effect.result
        );
        expect(verified).toMatchObject({ _tag: "Success" });
        const found = yield* Effect.promise(() =>
          runDispatch(t, publicRuntimeRequest())
        );
        const missing = yield* Effect.promise(() =>
          runDispatch(
            t,
            JSON.stringify({
              delivery: "public",
              appLocale: "en",
              publicPath: "subjects/test/missing",
            })
          )
        );
        expect(found.status).toBe(200);
        expect(JSON.parse(found.body)).toMatchObject({
          artifact: {
            payload: { contentKey: runtimeContentKey("public") },
          },
          delivery: "public",
          kind: "found",
          projection: { publicPath: TEST_RUNTIME_PATH },
          sourcePath: `packages/corpus/${runtimeContentKey("public")}/en.mdx`,
        });
        expect(missing).toEqual({ body: '{"kind":"missing"}', status: 404 });
      })
  );
  it("authenticates the real pair-grouped article source end to end", async () => {
    const t = createConvexTestWithBetterAuth();
    await t.mutation(async (ctx) => {
      await insertSignedRelease(ctx);
      await insertSignedHead(ctx, "public", TEST_ARTICLE_KEY, {
        projectionJson: TEST_ARTICLE_PROJECTION_JSON,
        publicPath: TEST_ARTICLE_PATH,
        rendererDomain: "politics",
        sourcePath: TEST_ARTICLE_SOURCE,
      });
    });
    const found = await runDispatch(t, articleRuntimeRequest());
    expect(found.status).toBe(200);
    expect(JSON.parse(found.body)).toMatchObject({
      artifact: {
        payload: {
          contentKey: TEST_ARTICLE_KEY,
          rendererDomain: "politics",
        },
      },
      delivery: "public",
      kind: "found",
      projection: {
        contentKey: TEST_ARTICLE_KEY,
        kind: "article",
        publicPath: TEST_ARTICLE_PATH,
      },
      sourcePath: TEST_ARTICLE_SOURCE,
    });
  });
  it("authenticates one signed public page end to end", async () => {
    const t = createConvexTestWithBetterAuth();
    await t.mutation(async (ctx) => {
      await insertSignedRelease(ctx);
      await insertSignedHead(ctx, "public", TEST_PAGE_KEY, {
        projectionJson: TEST_PAGE_PROJECTION_JSON,
        publicPath: TEST_PAGE_PATH,
        rendererDomain: "site",
        sourcePath: TEST_PAGE_SOURCE,
      });
    });
    const request = {
      appLocale: "en",
      delivery: "public",
      publicPath: TEST_PAGE_PATH,
    } as const;
    const [found, predecessor] = await Promise.all([
      runDispatch(t, JSON.stringify(request)),
      runDispatch(t, JSON.stringify(request), dispatchPredecessorProgram),
    ]);
    expect(found.status).toBe(200);
    const foundBody = JSON.parse(found.body);
    const predecessorBody = JSON.parse(predecessor.body);
    expect(foundBody).toMatchObject({
      artifact: {
        payload: {
          contentKey: TEST_PAGE_KEY,
          rendererDomain: "site",
        },
      },
      delivery: "public",
      kind: "found",
      projection: {
        contentKey: TEST_PAGE_KEY,
        kind: "public-page",
        publicPath: TEST_PAGE_PATH,
      },
      sourcePath: TEST_PAGE_SOURCE,
    });
    await expect(verifyRuntimeV150(request, predecessorBody)).resolves.toEqual(
      expect.objectContaining({
        verified: expect.objectContaining({ kind: "found" }),
      })
    );
    expect(predecessorBody.projection).toEqual(foundBody.projection);
    expect(predecessorBody.projectionHash).toBe(foundBody.projectionHash);
  });
  it("authenticates the exact active canonical material", async () => {
    const t = createConvexTestWithBetterAuth();
    await t.mutation(async (ctx) => {
      await insertSignedRelease(ctx);
      await insertSignedHead(ctx, "public", FUNCTION_MATERIAL_KEY, {
        projectionJson: FUNCTION_MATERIAL_JSON,
        publicPath: FUNCTION_MATERIAL_PATH,
        rendererDomain: "mathematics",
        sourcePath: FUNCTION_MATERIAL_SOURCE,
      });
    });
    const found = await runDispatch(
      t,
      JSON.stringify({
        delivery: "public",
        appLocale: "en",
        publicPath: FUNCTION_MATERIAL_PATH,
      })
    );
    expect(found.status).toBe(200);
    const body = JSON.parse(found.body);
    expect(body).toMatchObject({
      artifact: { payload: { contentKey: FUNCTION_MATERIAL_KEY } },
      kind: "found",
      projection: {
        contentKey: FUNCTION_MATERIAL_KEY,
        kind: "subject-lesson",
      },
      projectionHash: testTextHash(FUNCTION_MATERIAL_JSON),
      sourcePath: FUNCTION_MATERIAL_SOURCE,
    });
    expect(body.projection).toHaveProperty(
      "topicTitle",
      "Function Composition and Inverse Function"
    );
  });
  it("rejects malformed, mismatched, and oversized request bytes", async () => {
    const t = createConvexTestWithBetterAuth();
    const source = publicRuntimeRequest();
    const mismatch = await t.action((ctx) =>
      runConvexProgram(dispatchProgram(ctx, source, 1))
    );
    await expect(runDispatch(t, "{")).resolves.toMatchObject({ status: 400 });
    expect(mismatch.status).toBe(400);
    await expect(
      runDispatch(t, "x".repeat(MAX_PUBLIC_RUNTIME_REQUEST_BYTES + 1))
    ).resolves.toMatchObject({ status: 400 });
  });
  it("fails closed when authenticated stored evidence is tampered", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedSigned(t, "public");
    await t.mutation(async (ctx) => {
      const head = await ctx.db.query("contentHeads").unique();
      if (!head) {
        throw new Error("Expected one runtime head.");
      }
      await ctx.db.patch("contentHeads", head._id, {
        projectionHash: `sha256:${"f".repeat(64)}`,
      });
    });
    await expect(runDispatch(t, publicRuntimeRequest())).resolves.toEqual({
      body: '{"code":"CONTENT_RUNTIME_INTERNAL","kind":"failure"}',
      status: 500,
    });
  });
});
