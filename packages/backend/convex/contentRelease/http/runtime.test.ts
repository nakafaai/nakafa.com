// @vitest-environment node

import {
  decodeContentRuntimeRequest,
  MAX_RUNTIME_REQUEST_BYTES,
  MAX_RUNTIME_RESPONSE_BYTES,
} from "@nakafa/aksara-contracts/runtime/spec";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { verifyContentEnvelope } from "@repo/backend/content/verify";
import { internal } from "@repo/backend/convex/_generated/api";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { testProjectionJson } from "@repo/backend/test/content-release";
import {
  insertRuntimeRelease,
  runtimeCases,
  runtimeContentKey,
  runtimeRequest,
  TEST_RUNTIME_PATH,
} from "@repo/backend/test/content-runtime";
import { insertRuntimeHead } from "@repo/backend/test/runtime-head";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const RUNTIME_PATH = "/internal/content/runtime";
const RUNTIME_TOKEN = "technical-runtime-token";
const runtimeTokenName = "CONTENT_RUNTIME_TOKEN";
const polarName = "POLAR_WEBHOOK_SECRET";

type RuntimeTest = ReturnType<typeof createConvexTestWithBetterAuth>;
type RuntimeFetcher = Pick<RuntimeTest, "fetch">;

/** Sends one request through the actual registered Convex HTTP route. */
function post(t: RuntimeFetcher, body: BodyInit | null, headers?: HeadersInit) {
  return t.fetch(RUNTIME_PATH, {
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

describe("content runtime HTTP route", () => {
  it("authenticates the server secret before consuming a request body", async () => {
    const t = createConvexTestWithBetterAuth();
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>(
      {
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
    } satisfies RequestInit & { readonly duplex: "half" };

    const response = await t.fetch(RUNTIME_PATH, request);

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
    [runtimeRequest("public"), { "content-type": "text/plain" }, 415],
    [
      "x".repeat(MAX_RUNTIME_REQUEST_BYTES + 1),
      { "content-type": "application/json" },
      413,
    ],
    [
      JSON.stringify({
        delivery: "public",
        extra: true,
        locale: "en",
        publicPath: TEST_RUNTIME_PATH,
      }),
      { "content-type": "application/json" },
      400,
    ],
  ] as const)("rejects invalid bounded input", async (body, headers, status) => {
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
  });

  it("fails closed for an unreviewed signing key and returns exact absence", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedRuntime(t, "public");

    const found = await post(t, runtimeRequest("public"));
    const missing = await post(
      t,
      JSON.stringify({
        delivery: "public",
        locale: "en",
        publicPath: "test/missing",
      })
    );

    expect(found.status).toBe(500);
    await expect(found.json()).resolves.toEqual({
      code: "CONTENT_RUNTIME_INTERNAL",
      kind: "failure",
    });
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({ kind: "missing" });
    expectPrivate(found);
  });

  it("rejects found rows that do not belong to the exact request", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedRuntime(t, "public");
    const row = await t.query(internal.contentRelease.runtime.readPublic, {
      locale: "en",
      publicPath: TEST_RUNTIME_PATH,
    });
    if (!row) {
      throw new Error("Expected one public runtime row.");
    }
    const request = await Effect.runPromise(
      decodeContentRuntimeRequest(JSON.parse(runtimeRequest("public")))
    );
    for (const [reason, candidate] of runtimeCases(row)) {
      const result = await Effect.runPromise(
        verifyContentEnvelope({
          request,
          response: candidate,
        }).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            contentKeyResolver
          ),
          Effect.either
        )
      );
      expect(result, reason).toMatchObject({
        _tag: "Left",
        left: { _tag: "ContentEnvelopeMismatchError", reason },
      });
    }
  });

  it("rejects non-public delivery even when its stored head exists", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedRuntime(t, "authenticated");

    const response = await post(t, runtimeRequest("authenticated"));

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
        compiledCode: "x".repeat(MAX_RUNTIME_RESPONSE_BYTES / 2 + 1),
        projectionJson: testProjectionJson({
          contentKey: runtimeContentKey("public"),
          publicPath: TEST_RUNTIME_PATH,
          title: "x".repeat(MAX_RUNTIME_RESPONSE_BYTES / 2 + 1),
        }),
      });
    });

    const corruptResponse = await post(corrupt, runtimeRequest("public"));
    const oversizedResponse = await post(oversized, runtimeRequest("public"));

    expect(corruptResponse.status).toBe(500);
    expect(oversizedResponse.status).toBe(500);
    await expect(oversizedResponse.json()).resolves.toEqual({
      code: "CONTENT_RUNTIME_INTERNAL",
      kind: "failure",
    });
  });
});
