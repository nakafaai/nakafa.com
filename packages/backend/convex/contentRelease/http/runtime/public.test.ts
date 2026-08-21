// @vitest-environment node
import {
  decodePublicContentRuntimeRequest,
  MAX_PUBLIC_RUNTIME_REQUEST_BYTES,
  MAX_PUBLIC_RUNTIME_RESPONSE_BYTES,
} from "@nakafa/aksara-contracts/runtime/spec";
import { verifyContentRuntimeExchange } from "@nakafa/aksara-contracts/runtime/verify";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import {
  CONTENT_RUNTIME_RESPONSE_HEADER,
  CONTENT_RUNTIME_RESPONSE_MARKER,
  PUBLIC_CONTENT_RUNTIME_PATH,
} from "@repo/backend/content/endpoint";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { internal } from "@repo/backend/convex/_generated/api";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { testProjectionJson } from "@repo/backend/test/content-material";
import {
  insertRuntimeRelease,
  publicRuntimeRequest,
  runtimeCases,
  runtimeContentKey,
} from "@repo/backend/test/content-runtime";
import { insertRuntimeHead } from "@repo/backend/test/runtime-head";
import { TEST_RUNTIME_PATH } from "@repo/backend/test/runtime-values";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const RUNTIME_TOKEN = "technical-runtime-token";
const runtimeTokenName = "CONTENT_RUNTIME_TOKEN";
const polarName = "POLAR_WEBHOOK_SECRET";
type RuntimeTest = ReturnType<typeof createConvexTestWithBetterAuth>;
type RuntimeFetcher = Pick<RuntimeTest, "fetch">;
/** Sends one request through the actual registered Convex HTTP route. */
function post(t: RuntimeFetcher, body: BodyInit | null, headers?: HeadersInit) {
  return t.fetch(PUBLIC_CONTENT_RUNTIME_PATH, {
    body,
    headers: {
      "content-type": "application/json",
      "x-nakafa-content-token": RUNTIME_TOKEN,
      ...headers,
    },
    method: "POST",
  });
}
/** Asserts the private response headers shared by every route outcome. */
function expectPrivate(response: Response) {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("access-control-allow-origin")).toBeNull();
  expect(response.headers.get(CONTENT_RUNTIME_RESPONSE_HEADER)).toBe(
    CONTENT_RUNTIME_RESPONSE_MARKER
  );
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
}
/** Seeds one active route for an exact stored delivery class. */
function seedRuntime(
  t: RuntimeTest,
  delivery: "authenticated" | "entitled" | "public"
) {
  return t.mutation(async (ctx) => {
    await insertRuntimeRelease(ctx);
    await insertRuntimeHead(ctx, delivery, runtimeContentKey(delivery));
  });
}
beforeEach(() => {
  process.env[runtimeTokenName] = RUNTIME_TOKEN;
  process.env[polarName] = "technical-webhook-secret";
});
afterEach(() => {
  delete process.env[runtimeTokenName];
  delete process.env[polarName];
});
describe("public content runtime HTTP route", () => {
  it("authenticates the server secret before consuming a request body", async () => {
    const t = createConvexTestWithBetterAuth();
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        /** Records any attempt to consume a request before authentication. */
        pull(controller) {
          pulls += 1;
          controller.error(new Error("Unauthorized body was consumed."));
        },
      },
      { highWaterMark: 0 }
    );
    const request = {
      body,
      duplex: "half",
      headers: {
        "content-type": "application/json",
        "x-nakafa-content-token": "wrong-token",
      },
      method: "POST",
    } satisfies RequestInit & {
      readonly duplex: "half";
    };
    const response = await t.fetch(PUBLIC_CONTENT_RUNTIME_PATH, request);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "CONTENT_RUNTIME_UNAUTHORIZED",
      kind: "failure",
    });
    expect(pulls).toBe(0);
    expectPrivate(response);
  });
  it.each([
    ["{", { "content-type": "application/json" }, 400],
    ["{}", { "content-length": "3" }, 400],
    [publicRuntimeRequest(), { "content-type": "text/plain" }, 415],
    [
      "x".repeat(MAX_PUBLIC_RUNTIME_REQUEST_BYTES + 1),
      { "content-type": "application/json" },
      413,
    ],
    [
      JSON.stringify({
        delivery: "public",
        extra: true,
        appLocale: "en",
        publicPath: TEST_RUNTIME_PATH,
      }),
      { "content-type": "application/json" },
      400,
    ],
  ] as const)(
    "rejects invalid bounded input",
    async (body, headers, status) => {
      const response = await post(
        createConvexTestWithBetterAuth(),
        body,
        headers
      );
      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toEqual({
        code: "CONTENT_RUNTIME_INVALID",
        kind: "failure",
      });
    }
  );
  it("transports evidence for application verification and exact absence", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedRuntime(t, "public");
    const found = await post(t, publicRuntimeRequest());
    const missing = await post(
      t,
      JSON.stringify({
        delivery: "public",
        appLocale: "en",
        publicPath: "subjects/test/missing",
      })
    );
    expect(found.status).toBe(200);
    const foundBody = await found.json();
    expect(foundBody).toMatchObject({ kind: "found" });
    const request = await Effect.runPromise(
      decodePublicContentRuntimeRequest(JSON.parse(publicRuntimeRequest()))
    );
    const rejected = await Effect.runPromise(
      verifyContentRuntimeExchange({
        rendererManifest: foundBody.rendererManifest,
        request,
        response: foundBody,
      }).pipe(
        Effect.provideService(
          ContentVerificationKeyResolver,
          contentKeyResolver
        ),
        Effect.flip
      )
    );
    expect(rejected._tag).toBe("ReleaseManifestHashMismatchError");
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({ kind: "missing" });
    expectPrivate(found);
  });
  it("rejects found rows that do not belong to the exact request", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedRuntime(t, "public");
    const row = await t.query(
      internal.contentRelease.runtime.public.internal.read,
      { appLocale: "en", publicPath: TEST_RUNTIME_PATH }
    );
    if (!row) {
      throw new Error("Expected one public runtime row.");
    }
    const request = await Effect.runPromise(
      decodePublicContentRuntimeRequest(JSON.parse(publicRuntimeRequest()))
    );
    for (const [reason, candidate] of runtimeCases(row)) {
      const result = await Effect.runPromise(
        verifyContentRuntimeExchange({
          rendererManifest: JSON.parse(row.rendererJson),
          request,
          response: candidate,
        }).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            contentKeyResolver
          ),
          Effect.result
        )
      );
      expect(result, reason).toMatchObject({
        _tag: "Failure",
        failure: { _tag: "ContentRuntimeMismatchError", reason },
      });
    }
  });
  it("rejects non-public delivery even when its stored head exists", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedRuntime(t, "authenticated");
    const response = await post(
      t,
      JSON.stringify({
        delivery: "authenticated",
        appLocale: "en",
        publicPath: TEST_RUNTIME_PATH,
      })
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "CONTENT_RUNTIME_INVALID",
      kind: "failure",
    });
  });
  it("fails closed for corrupt or oversized runtime state", async () => {
    const corrupt = createConvexTestWithBetterAuth();
    await seedRuntime(corrupt, "public");
    await corrupt.mutation(async (ctx) => {
      const head = await ctx.db.query("contentHeads").unique();
      if (!head) {
        throw new Error("Expected a corruptible runtime head.");
      }
      await ctx.db.patch("contentHeads", head._id, {
        projectionHash: `sha256:${"f".repeat(64)}`,
      });
    });
    const oversized = createConvexTestWithBetterAuth();
    await oversized.mutation(async (ctx) => {
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
    const corruptResponse = await post(corrupt, publicRuntimeRequest());
    const oversizedResponse = await post(oversized, publicRuntimeRequest());
    expect(corruptResponse.status).toBe(500);
    expect(oversizedResponse.status).toBe(500);
    expectPrivate(corruptResponse);
    expectPrivate(oversizedResponse);
    await expect(oversizedResponse.json()).resolves.toEqual({
      code: "CONTENT_RUNTIME_RESPONSE_TOO_LARGE",
      kind: "failure",
    });
  });
});
