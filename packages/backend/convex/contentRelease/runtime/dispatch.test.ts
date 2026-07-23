// @vitest-environment node

import {
  decodeContentRuntimeRequest,
  MAX_RUNTIME_REQUEST_BYTES,
} from "@nakafa/aksara-contracts/runtime/spec";
import { verifyContentRuntimeExchange } from "@nakafa/aksara-contracts/runtime/verify";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { internal } from "@repo/backend/convex/_generated/api";
import { dispatchProgram } from "@repo/backend/convex/contentRelease/runtime/dispatch";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { TEST_KEY_RESOLVER } from "@repo/backend/test/content-proof";
import {
  insertSignedHead,
  insertSignedRelease,
  runtimeRequest,
  TEST_RUNTIME_NOW,
  TEST_RUNTIME_PATH,
} from "@repo/backend/test/content-runtime";
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

/** Seeds one authenticated active route and optional application identity. */
function seedSigned(
  t: RuntimeTest,
  delivery: "authenticated" | "entitled" | "public",
  plan?: "free" | "pro"
) {
  return t.mutation(async (ctx) => {
    await insertSignedRelease(ctx);
    await insertSignedHead(ctx, delivery, `test:${delivery}`);
    if (!plan) {
      return null;
    }
    return seedAuthenticatedUser(ctx, {
      now: TEST_RUNTIME_NOW,
      plan,
      suffix: `signed-${delivery}-${plan}`,
    });
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
      verifyContentRuntimeExchange({
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
      artifact: { payload: { contentKey: "test:public" } },
      delivery: "public",
      kind: "found",
      projection: { publicPath: TEST_RUNTIME_PATH },
      sourcePath: "packages/corpus/material/lesson/test/public/en.mdx",
    });
    expect(missing).toEqual({ body: '{"kind":"missing"}', status: 404 });
  });

  it("enforces authentication before returning authenticated content", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await seedSigned(t, "authenticated", "free");
    if (!identity) {
      throw new Error("Expected one authenticated runtime identity.");
    }
    const authenticated = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    await expect(
      runDispatch(t, runtimeRequest("authenticated"))
    ).resolves.toMatchObject({ status: 401 });
    await expect(
      runDispatch(authenticated, runtimeRequest("authenticated"))
    ).resolves.toMatchObject({ status: 200 });
  });

  it("enforces the Pro plan before returning entitled content", async () => {
    const free = createConvexTestWithBetterAuth();
    const freeIdentity = await seedSigned(free, "entitled", "free");
    const pro = createConvexTestWithBetterAuth();
    const proIdentity = await seedSigned(pro, "entitled", "pro");
    if (!(freeIdentity && proIdentity)) {
      throw new Error("Expected both entitled runtime identities.");
    }

    const forbidden = await runDispatch(
      free.withIdentity({
        sessionId: freeIdentity.sessionId,
        subject: freeIdentity.authUserId,
      }),
      runtimeRequest("entitled")
    );
    const entitled = await runDispatch(
      pro.withIdentity({
        sessionId: proIdentity.sessionId,
        subject: proIdentity.authUserId,
      }),
      runtimeRequest("entitled")
    );

    expect(forbidden.status).toBe(403);
    expect(entitled.status).toBe(200);
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
