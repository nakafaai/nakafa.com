// @vitest-environment node

import {
  decodeContentRuntimeRequest,
  MAX_RUNTIME_REQUEST_BYTES,
} from "@nakafa/aksara-contracts/runtime/spec";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { verifyContentEnvelope } from "@repo/backend/content/verify";
import { internal } from "@repo/backend/convex/_generated/api";
import { dispatchProgram } from "@repo/backend/convex/contentRelease/runtime/dispatch";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  FUNCTION_MATERIAL_KEY,
  FUNCTION_MATERIAL_PATH,
  FUNCTION_MATERIAL_SOURCE,
  FUNCTION_MATERIAL_V2_JSON,
} from "@repo/backend/test/content-material";
import { TEST_KEY_RESOLVER } from "@repo/backend/test/content-proof";
import {
  articleRuntimeRequest,
  insertSignedRelease,
  runtimeContentKey,
  runtimeRequest,
  TEST_ARTICLE_KEY,
  TEST_ARTICLE_PATH,
  TEST_ARTICLE_PROJECTION_JSON,
  TEST_ARTICLE_SOURCE,
} from "@repo/backend/test/content-runtime";
import { insertSignedHead } from "@repo/backend/test/runtime-head";
import { TEST_RUNTIME_PATH } from "@repo/backend/test/runtime-values";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

type RuntimeTest = ReturnType<typeof createConvexTestWithBetterAuth>;
type RuntimeAction = Pick<RuntimeTest, "action">;

/** Executes the deep runtime program with the isolated signing authority. */
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

describe("contentRelease/runtime/dispatch", () => {
  it("returns one fully authenticated public artifact and exact absence", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedSigned(t, "public");
    const row = await t.query(internal.contentRelease.runtime.readPublic, {
      locale: "en",
      publicPath: TEST_RUNTIME_PATH,
    });
    if (!row) {
      throw new Error("Expected one signed runtime row.");
    }
    const request = await Effect.runPromise(
      decodeContentRuntimeRequest(JSON.parse(runtimeRequest("public")))
    );
    const verified = await Effect.runPromise(
      verifyContentEnvelope({
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
        Effect.either
      )
    );
    expect(verified).toMatchObject({ _tag: "Right" });

    const found = await runDispatch(t, runtimeRequest("public"));
    const missing = await runDispatch(
      t,
      JSON.stringify({
        delivery: "public",
        locale: "en",
        publicPath: "test/missing",
      })
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
  });

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

  it("authenticates the exact active v2 material through the current runtime", async () => {
    const t = createConvexTestWithBetterAuth();
    await t.mutation(async (ctx) => {
      await insertSignedRelease(ctx);
      await insertSignedHead(ctx, "public", FUNCTION_MATERIAL_KEY, {
        projectionJson: FUNCTION_MATERIAL_V2_JSON,
        publicPath: FUNCTION_MATERIAL_PATH,
        rendererDomain: "mathematics",
        sourcePath: FUNCTION_MATERIAL_SOURCE,
      });
    });

    const found = await runDispatch(
      t,
      JSON.stringify({
        delivery: "public",
        locale: "en",
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
      projectionHash:
        "sha256:1d80cfc727a8d84ad952b34c79e437acc2ab73360addd1c9d7eea78791eea21d",
      sourcePath: FUNCTION_MATERIAL_SOURCE,
    });
    expect(body.projection).not.toHaveProperty("topicTitle");
  });

  it("rejects non-public delivery before reading restricted heads", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedSigned(t, "authenticated");

    await expect(
      runDispatch(t, runtimeRequest("authenticated"))
    ).resolves.toEqual({
      body: '{"code":"CONTENT_RUNTIME_INVALID","kind":"failure"}',
      status: 400,
    });
  });

  it("rejects malformed, mismatched, and oversized request bytes", async () => {
    const t = createConvexTestWithBetterAuth();
    const source = runtimeRequest("public");
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

    await expect(runDispatch(t, "{")).resolves.toMatchObject({ status: 400 });
    expect(mismatch.status).toBe(400);
    await expect(
      runDispatch(t, "x".repeat(MAX_RUNTIME_REQUEST_BYTES + 1))
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

    await expect(runDispatch(t, runtimeRequest("public"))).resolves.toEqual({
      body: '{"code":"CONTENT_RUNTIME_INTERNAL","kind":"failure"}',
      status: 500,
    });
  });
});
