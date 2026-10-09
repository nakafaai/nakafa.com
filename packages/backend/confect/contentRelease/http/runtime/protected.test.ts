import { RegisteredFunction } from "@confect/server";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { Effect, Layer, Schema } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { MAX_PROTECTED_RUNTIME_REQUEST_BYTES } from "@nakafa/aksara-contracts/runtime/protected/limits";
import { ProtectedContentRuntimeRequestSchema } from "@nakafa/aksara-contracts/runtime/protected/spec";
import { protectedRuntimeRoutes } from "@repo/backend/confect/contentRelease/http/runtime/protected";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import {
  CONTENT_RUNTIME_RESPONSE_HEADER,
  CONTENT_RUNTIME_RESPONSE_MARKER,
  PROTECTED_CONTENT_RUNTIME_PATH,
} from "@repo/backend/content/endpoint";
import { insertRuntimeRelease } from "@repo/backend/test/content/runtime";
import { JsonTextSchema } from "@repo/utilities/json";

const RUNTIME_TOKEN = "technical-runtime-token";
const runtimeTokenName = "CONTENT_RUNTIME_TOKEN";
const polarName = "POLAR_WEBHOOK_SECRET";
const digest = `sha256:${"a".repeat(64)}`;
const request = {
  bundleHash: digest,
  selectors: [
    {
      artifactHash: digest,
      contentKey:
        "question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1/question-1/question",
      delivery: "authenticated",
    },
  ],
  snapshotId: digest,
};
/** Encodes one protected request through the contract, so a malformed fixture fails here. */
const requestJson = Schema.encodeUnknownSync(
  Schema.fromJsonString(ProtectedContentRuntimeRequestSchema)
);
/** Encodes a body the contract rejects, keeping its exact invalid wire bytes. */
const malformedJson = Schema.encodeUnknownSync(JsonTextSchema);
type RuntimeTest = ReturnType<typeof createConvexTestWithBetterAuth>;

/** Sends one request through the registered protected Convex route. */
function post(
  target: RuntimeTest,
  path: string,
  body: BodyInit | null,
  token = RUNTIME_TOKEN
) {
  return target.fetch(path, {
    body,
    headers: {
      "content-type": "application/json",
      "x-nakafa-content-token": token,
    },
    method: "POST",
  });
}
beforeEach(() => {
  process.env[runtimeTokenName] = RUNTIME_TOKEN;
  process.env[polarName] = "technical-webhook-secret";
});
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env[runtimeTokenName];
  delete process.env[polarName];
});
describe("protected content runtime HTTP route", () => {
  it.each(["rejected", "invalid-result"])(
    "sanitizes a %s Node verifier response",
    async (failure) => {
      const target = createConvexTestWithBetterAuth();
      const response = await target.action(async (ctx) => {
        const action = vi.spyOn(ctx, "runAction");
        if (failure === "rejected") {
          action.mockRejectedValueOnce(new Error("private verifier details"));
        } else {
          action.mockResolvedValueOnce({
            status: 200,
          });
        }
        const result = await Effect.runPromise(
          Effect.acquireUseRelease(
            Effect.sync(() =>
              HttpRouter.toWebHandler(
                protectedRuntimeRoutes.pipe(
                  Layer.provideMerge(
                    RegisteredFunction.actionLayer(confectSchema, ctx)
                  ),
                  Layer.provide(HttpServer.layerServices)
                ),
                {
                  disableLogger: true,
                }
              )
            ),
            ({ handler }) =>
              Effect.promise(() =>
                handler(
                  new Request(
                    `https://test.invalid${PROTECTED_CONTENT_RUNTIME_PATH}`,
                    {
                      method: "POST",
                      body: requestJson(request),
                      headers: {
                        "content-type": "application/json",
                        "x-nakafa-content-token": RUNTIME_TOKEN,
                      },
                    }
                  )
                )
              ),
            ({ dispose }) => Effect.promise(dispose)
          )
        );
        return {
          status: result.status,
          cache: result.headers.get("cache-control"),
          body: await result.json(),
        };
      });
      expect(response.status).toBe(500);
      expect(response.cache).toBe("private, no-store");
      expect(response.body).toEqual({
        kind: "failure",
        code: "CONTENT_RUNTIME_INTERNAL",
      });
    }
  );
  it("fails closed when the secret comparison cannot execute", async () => {
    vi.spyOn(crypto.subtle, "digest").mockRejectedValueOnce(
      new Error("crypto unavailable")
    );
    const response = await post(
      createConvexTestWithBetterAuth(),
      PROTECTED_CONTENT_RUNTIME_PATH,
      requestJson(request)
    );
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      kind: "failure",
      code: "CONTENT_RUNTIME_INTERNAL",
    });
  });
  it("returns exact absence for a valid permanent batch", async () => {
    const target = createConvexTestWithBetterAuth();
    await target.mutation((ctx) => insertRuntimeRelease(ctx));
    const response = await post(
      target,
      PROTECTED_CONTENT_RUNTIME_PATH,
      requestJson(request)
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      kind: "missing",
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get(CONTENT_RUNTIME_RESPONSE_HEADER)).toBe(
      CONTENT_RUNTIME_RESPONSE_MARKER
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
  it("rejects unauthorized, malformed, and oversized requests", async () => {
    const target = createConvexTestWithBetterAuth();
    const unauthorized = await post(
      target,
      PROTECTED_CONTENT_RUNTIME_PATH,
      requestJson(request),
      "wrong-token"
    );
    const malformed = await post(
      target,
      PROTECTED_CONTENT_RUNTIME_PATH,
      malformedJson({
        ...request,
        selectors: [],
      })
    );
    const oversized = await post(
      target,
      PROTECTED_CONTENT_RUNTIME_PATH,
      "x".repeat(MAX_PROTECTED_RUNTIME_REQUEST_BYTES + 1)
    );
    expect(unauthorized.status).toBe(401);
    await expect(unauthorized.json()).resolves.toMatchObject({
      code: "CONTENT_RUNTIME_UNAUTHORIZED",
    });
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toMatchObject({
      code: "CONTENT_RUNTIME_INVALID",
    });
    expect(oversized.status).toBe(413);
    await expect(oversized.json()).resolves.toMatchObject({
      code: "CONTENT_RUNTIME_INVALID",
    });
  });
});
