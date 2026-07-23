// @vitest-environment node

import { MAX_RUNTIME_RESPONSE_BYTES } from "@nakafa/aksara-contracts/runtime/spec";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPublicContentRuntime } from "@/lib/content/published/request";
import { previewProjection, previewWireArtifact } from "@/test/content-preview";
import { createRuntimeFoundBody } from "@/test/content-runtime";

const runtimeEnv = vi.hoisted(() => ({
  CONTENT_RUNTIME_TOKEN: "runtime-test-token",
  NEXT_PUBLIC_CONVEX_SITE_URL: "https://example.convex.site/ignored/path",
}));
const fetchMock = vi.hoisted(() => vi.fn<typeof fetch>());
const endpoint = "https://example.convex.site/internal/content/runtime";
const request = {
  delivery: "public",
  locale: "en",
  publicPath:
    "subjects/mathematics/function-composition-inverse-function/function-concept",
} as const;

vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({ env: runtimeEnv }));

/** Creates one fetch response with the immutable network URL populated. */
function createResponse(
  body: BodyInit | null,
  status: number,
  headers: HeadersInit = {
    "content-type": "application/json; charset=utf-8",
  },
  url = endpoint
) {
  const response = new Response(body, { headers, status });
  Object.defineProperty(response, "url", { value: url });

  return response;
}

/** Executes one request through the Effect runtime test boundary. */
function execute(input: unknown = request) {
  return Effect.runPromise(fetchPublicContentRuntime(input));
}

/** Executes one request while exposing its typed failure value. */
function reject(input: unknown = request) {
  return Effect.runPromise(fetchPublicContentRuntime(input).pipe(Effect.flip));
}

beforeEach(() => {
  runtimeEnv.CONTENT_RUNTIME_TOKEN = "runtime-test-token";
  runtimeEnv.NEXT_PUBLIC_CONVEX_SITE_URL =
    "https://example.convex.site/ignored/path";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("published content runtime request", () => {
  it("posts one bounded public no-store request to the fixed Convex URL", async () => {
    const body = JSON.stringify({ kind: "missing" });
    fetchMock.mockResolvedValue(
      createResponse(body, 404, {
        "content-length": String(new TextEncoder().encode(body).byteLength),
        "content-type": "application/json; charset=utf-8",
      })
    );

    await expect(execute()).resolves.toEqual({
      request,
      response: { kind: "missing" },
      status: 404,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        body: JSON.stringify(request),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-nakafa-content-token": "runtime-test-token",
        },
        method: "POST",
        redirect: "error",
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("accepts decoded bytes whose wire length described compressed data", async () => {
    fetchMock.mockResolvedValue(
      createResponse(JSON.stringify({ kind: "missing" }), 404, {
        "content-encoding": "gzip",
        "content-length": "1",
        "content-type": "application/json",
      })
    );

    await expect(execute()).resolves.toMatchObject({
      response: { kind: "missing" },
      status: 404,
    });
  });

  it("accepts a complete found response before integrity verification", async () => {
    fetchMock.mockResolvedValue(
      createResponse(await createRuntimeFoundBody(), 200)
    );

    await expect(execute()).resolves.toMatchObject({
      response: {
        artifact: previewWireArtifact,
        kind: "found",
        projection: previewProjection,
      },
      status: 200,
    });
  });

  it.each([
    ["CONTENT_RUNTIME_FORBIDDEN", 403],
    ["CONTENT_RUNTIME_INTERNAL", 500],
    ["CONTENT_RUNTIME_INVALID", 400],
    ["CONTENT_RUNTIME_INVALID", 413],
    ["CONTENT_RUNTIME_INVALID", 415],
    ["CONTENT_RUNTIME_UNAUTHORIZED", 401],
  ] as const)("accepts exact %s status %i", async (code, status) => {
    fetchMock.mockResolvedValue(
      createResponse(JSON.stringify({ code, kind: "failure" }), status)
    );

    await expect(execute()).resolves.toMatchObject({
      response: { code, kind: "failure" },
      status,
    });
  });

  it.each([
    ["not a URL", "url"],
    ["http://example.com", "url"],
    ["ftp://localhost/runtime", "url"],
    ["https://user:secret@example.com", "url"],
  ] as const)("rejects unsafe runtime URL %s", async (url, reason) => {
    runtimeEnv.NEXT_PUBLIC_CONVEX_SITE_URL = url;

    await expect(reject()).resolves.toMatchObject({
      _tag: "ContentTransportError",
      reason,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows plain HTTP only for local Convex infrastructure", async () => {
    runtimeEnv.NEXT_PUBLIC_CONVEX_SITE_URL = "http://localhost:3211/path";
    fetchMock.mockResolvedValue(
      createResponse(
        JSON.stringify({ kind: "missing" }),
        404,
        undefined,
        "http://localhost:3211/internal/content/runtime"
      )
    );

    await expect(execute()).resolves.toMatchObject({ status: 404 });
  });

  it("rejects a fetch failure without exposing transport details", async () => {
    fetchMock.mockRejectedValue(new Error("private network detail"));

    await expect(reject()).resolves.toMatchObject({
      _tag: "ContentTransportError",
      reason: "fetch",
    });
  });

  it.each([
    [
      createResponse(
        JSON.stringify({ kind: "missing" }),
        404,
        undefined,
        "https://other.example/runtime"
      ),
      "response-url",
    ],
    [
      createResponse("{}", 404, { "content-type": "text/plain" }),
      "content-type",
    ],
    [createResponse(null, 404, {}), "content-type"],
    [
      createResponse("{}", 404, {
        "content-length": "invalid",
        "content-type": "application/json",
      }),
      "content-length",
    ],
    [
      createResponse("{}", 404, {
        "content-length": "-1",
        "content-type": "application/json",
      }),
      "content-length",
    ],
    [
      createResponse("{}", 404, {
        "content-length": "9".repeat(400),
        "content-type": "application/json",
      }),
      "content-length",
    ],
    [
      createResponse("{}", 404, {
        "content-length": String(MAX_RUNTIME_RESPONSE_BYTES + 1),
        "content-type": "application/json",
      }),
      "content-length",
    ],
    [createResponse("{", 404), "json"],
    [createResponse(JSON.stringify({ kind: "missing" }), 200), "status"],
    [
      createResponse(
        JSON.stringify({ code: "CONTENT_RUNTIME_FORBIDDEN", kind: "failure" }),
        500
      ),
      "status",
    ],
  ] as const)("rejects an invalid response as %s", async (response, reason) => {
    fetchMock.mockResolvedValue(response);

    await expect(reject()).resolves.toMatchObject({
      _tag: "ContentTransportError",
      reason,
    });
  });

  it("rejects unreadable, invalid UTF-8, and oversized bodies", async () => {
    const unreadable = createResponse(
      new ReadableStream<Uint8Array>({
        /** Fails before exposing provider bytes. */
        pull(controller) {
          controller.error(new TypeError("unreadable"));
        },
      }),
      404
    );
    const invalidUtf8 = createResponse(new Uint8Array([255]), 404);
    const oversized = createResponse(
      "x".repeat(MAX_RUNTIME_RESPONSE_BYTES + 1),
      404
    );

    fetchMock
      .mockResolvedValueOnce(unreadable)
      .mockResolvedValueOnce(invalidUtf8)
      .mockResolvedValueOnce(oversized);

    await expect(reject()).resolves.toMatchObject({ reason: "body" });
    await expect(reject()).resolves.toMatchObject({ reason: "body" });
    await expect(reject()).resolves.toMatchObject({
      reason: "response-size",
    });
  });

  it("fails before network access for invalid or non-public requests", async () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;

    await expect(
      Effect.runPromise(fetchPublicContentRuntime(undefined).pipe(Effect.flip))
    ).resolves.toMatchObject({ reason: "request" });
    await expect(reject(cyclic)).resolves.toMatchObject({ reason: "request" });
    await expect(
      reject({ ...request, publicPath: "a".repeat(5000) })
    ).resolves.toMatchObject({ reason: "request-size" });
    await expect(
      reject({ ...request, delivery: "authenticated" })
    ).resolves.toMatchObject({ reason: "delivery" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves a shared contract decode failure for malformed JSON values", async () => {
    fetchMock.mockResolvedValue(createResponse("{}", 200));

    await expect(reject()).resolves.toMatchObject({
      _tag: "ContractDecodeError",
      contract: "ContentRuntimeResponse",
    });
  });
});
