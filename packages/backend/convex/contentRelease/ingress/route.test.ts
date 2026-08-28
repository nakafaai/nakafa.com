// @vitest-environment node

import { afterEach, beforeAll, describe, expect, it } from "@effect/vitest";
import { MAX_PUBLICATION_REQUEST_BYTES } from "@nakafa/aksara-contracts/transport/limits";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest, type TestConvex } from "convex-test";

const publicationPath = "/internal/content/releases";
const polarName = "POLAR_WEBHOOK_SECRET";
const tokenName = "AKSARA_PUBLICATION_TOKEN";
let target: TestConvex<typeof schema>;

/** Posts one complete body through the actual Convex HTTP router. */
function post(source: string, headers?: HeadersInit) {
  process.env[polarName] = "technical-webhook-secret";
  return target.fetch(publicationPath, {
    body: source,
    headers: {
      authorization: "Bearer technical-token",
      "content-type": "application/json",
      ...headers,
    },
    method: "POST",
  });
}

/** Prepares one read-only router before per-case timing begins. */
beforeAll(async () => {
  target = convexTest(schema, convexModules);
  process.env[tokenName] = "technical-token";
  const response = await post('{"operation":"current"}');
  await response.arrayBuffer();
  delete process.env[tokenName];
  delete process.env[polarName];
});

/** Asserts the publication endpoint never exposes cacheable response bytes. */
function expectPrivate(response: Response) {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("access-control-allow-origin")).toBeNull();
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
}

afterEach(() => {
  delete process.env[tokenName];
  delete process.env[polarName];
});

describe("content publication HTTP route", () => {
  it("returns the authoritative empty publication state", async () => {
    process.env[tokenName] = "technical-token";
    const response = await post('{"operation":"current"}');

    expect(response.status).toBe(200);
    expectPrivate(response);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      operation: "current",
      value: {
        active: null,
        candidate: null,
        recovery: null,
        tryoutRuntimeBundle: null,
      },
    });
  });

  it("authenticates before decoding or dispatching operations", async () => {
    process.env[tokenName] = "technical-token";
    const response = await post("{", { authorization: "Bearer wrong-token" });
    const oversized = await post(
      "x".repeat(MAX_PUBLICATION_REQUEST_BYTES + 1),
      { authorization: "Bearer wrong-token" }
    );

    expect(response.status).toBe(401);
    expect(oversized.status).toBe(401);
    expectPrivate(response);
    await expect(response.json()).resolves.toEqual({
      failure: {
        code: "CONTENT_RELEASE_UNAUTHORIZED",
        kind: "unauthorized",
      },
      ok: false,
    });

    process.env[polarName] = "technical-webhook-secret";
    const missing = await target.fetch(publicationPath, {
      body: "{",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    expect(missing.status).toBe(401);
  });

  it("does not pull a hostile request stream before bearer rejection", async () => {
    process.env[tokenName] = "technical-token";
    process.env[polarName] = "technical-webhook-secret";
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        /** Records any attempt to consume a request before bearer rejection. */
        pull(controller) {
          pulls += 1;
          controller.error(new Error("The unauthorized body was consumed."));
        },
      },
      { highWaterMark: 0 }
    );
    const request = {
      body,
      duplex: "half",
      headers: {
        authorization: "Bearer wrong-token",
        "content-type": "application/json",
      },
      method: "POST",
    } satisfies RequestInit & { readonly duplex: "half" };

    const response = await target.fetch(publicationPath, request);

    expect(response.status).toBe(401);
    expect(pulls).toBe(0);
  });

  it("rejects unsupported and malformed authenticated bodies", async () => {
    process.env[tokenName] = "technical-token";
    const unsupported = await post('{"operation":"current"}', {
      "content-type": "text/plain",
    });
    const malformed = await post("{");

    expect(unsupported.status).toBe(415);
    expect(malformed.status).toBe(400);
  });

  it("rejects complete bodies and Node envelopes above their ceilings", async () => {
    process.env[tokenName] = "technical-token";
    const complete = await post("x".repeat(MAX_PUBLICATION_REQUEST_BYTES + 1));
    const envelope = await post("x".repeat(MAX_PUBLICATION_REQUEST_BYTES - 1));

    expect(complete.status).toBe(413);
    expect(envelope.status).toBe(413);
  });
});
