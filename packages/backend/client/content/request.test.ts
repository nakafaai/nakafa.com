// @vitest-environment node

import { MAX_RUNTIME_RESPONSE_BYTES } from "@nakafa/aksara-contracts/runtime/spec";
import { fetchPublicContentRuntime } from "@repo/backend/client/content/request";
import { testArtifactJson } from "@repo/backend/test/content-artifact";
import {
  TEST_DIGEST,
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
  testProjectionJson,
  testReleaseJson,
  testRendererJson,
} from "@repo/backend/test/content-release";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const endpoint = "https://example.convex.site/internal/content/runtime";
const target = {
  siteUrl: "https://example.convex.site/ignored/path",
  token: "runtime-test-token",
};
const request = {
  delivery: "public",
  locale: "en",
  publicPath: "test/head-0",
} as const;
const fetchMock = vi.hoisted(() => vi.fn<typeof fetch>());

vi.mock("server-only", () => ({}));

/** Creates one response with the immutable network URL populated. */
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

/** Creates one structurally complete found response for transport decoding. */
function foundBody() {
  const projection = JSON.parse(testProjectionJson());
  const release = JSON.parse(testReleaseJson());

  return JSON.stringify({
    activeManifestHash: TEST_MANIFEST_HASH,
    activeReleaseId: TEST_RELEASE_ID,
    artifact: JSON.parse(testArtifactJson()),
    delivery: "public",
    kind: "found",
    projection,
    projectionHash: TEST_DIGEST,
    release,
    rendererManifest: JSON.parse(testRendererJson()),
    sourcePath: "packages/corpus/test/head-0/en.mdx",
  });
}

/** Runs one request through the Effect test boundary. */
function execute(input: unknown = request, runtimeTarget = target) {
  return Effect.runPromise(fetchPublicContentRuntime(runtimeTarget, input));
}

/** Exposes one request's typed failure value. */
function reject(input: unknown = request, runtimeTarget = target) {
  return Effect.runPromise(
    fetchPublicContentRuntime(runtimeTarget, input).pipe(Effect.flip)
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("public content runtime request", () => {
  it("posts one bounded public no-store request to the fixed endpoint", async () => {
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
    expect(fetchMock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        body: JSON.stringify(request),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-nakafa-content-token": target.token,
        },
        method: "POST",
        redirect: "error",
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("accepts exact found and sanitized failure status pairs", async () => {
    fetchMock
      .mockResolvedValueOnce(createResponse(foundBody(), 200))
      .mockResolvedValueOnce(
        createResponse(
          JSON.stringify({
            code: "CONTENT_RUNTIME_UNAUTHORIZED",
            kind: "failure",
          }),
          401
        )
      )
      .mockResolvedValueOnce(
        createResponse(
          JSON.stringify({
            code: "CONTENT_RUNTIME_INTERNAL",
            kind: "failure",
          }),
          500
        )
      );

    await expect(execute()).resolves.toMatchObject({
      response: { kind: "found" },
      status: 200,
    });
    await expect(execute()).resolves.toMatchObject({
      response: { code: "CONTENT_RUNTIME_UNAUTHORIZED", kind: "failure" },
      status: 401,
    });
    await expect(execute()).resolves.toMatchObject({
      response: { code: "CONTENT_RUNTIME_INTERNAL", kind: "failure" },
      status: 500,
    });
  });

  it.each([400, 413, 415])(
    "accepts an invalid request response with status %i",
    async (status) => {
      fetchMock.mockResolvedValue(
        createResponse(
          JSON.stringify({
            code: "CONTENT_RUNTIME_INVALID",
            kind: "failure",
          }),
          status
        )
      );

      await expect(execute()).resolves.toMatchObject({ status });
    }
  );

  it.each([
    ["not a URL", "url"],
    ["http://example.com", "url"],
    ["ftp://localhost", "url"],
    ["https://user:secret@example.com", "url"],
  ] as const)("rejects unsafe target %s", async (siteUrl, reason) => {
    await expect(
      reject(request, { ...target, siteUrl })
    ).resolves.toMatchObject({ reason });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows plain HTTP only for loopback infrastructure", async () => {
    fetchMock.mockResolvedValue(
      createResponse(
        JSON.stringify({ kind: "missing" }),
        404,
        undefined,
        "http://localhost:3211/internal/content/runtime"
      )
    );

    await expect(
      execute(request, { ...target, siteUrl: "http://localhost:3211/path" })
    ).resolves.toMatchObject({ status: 404 });
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
    [
      createResponse("{}", 404, {
        "content-length": "invalid",
        "content-type": "application/json",
      }),
      "content-length",
    ],
    [createResponse("{", 404), "json"],
    [createResponse("{}", 404), "json"],
    [createResponse(JSON.stringify({ kind: "missing" }), 200), "status"],
  ] as const)("rejects an invalid response as %s", async (response, reason) => {
    fetchMock.mockResolvedValue(response);

    await expect(reject()).resolves.toMatchObject({ reason });
  });

  it("rejects fetch, unreadable, invalid UTF-8, and oversized bodies", async () => {
    const unreadable = createResponse(
      new ReadableStream<Uint8Array>({
        /** Fails the response stream on its first read. */
        pull(controller) {
          controller.error(new TypeError("unreadable"));
        },
      }),
      404
    );
    fetchMock
      .mockRejectedValueOnce(new Error("private network detail"))
      .mockResolvedValueOnce(unreadable)
      .mockResolvedValueOnce(createResponse(new Uint8Array([255]), 404))
      .mockResolvedValueOnce(
        createResponse("x".repeat(MAX_RUNTIME_RESPONSE_BYTES + 1), 404)
      );

    await expect(reject()).resolves.toMatchObject({ reason: "fetch" });
    await expect(reject()).resolves.toMatchObject({ reason: "body" });
    await expect(reject()).resolves.toMatchObject({ reason: "body" });
    await expect(reject()).resolves.toMatchObject({
      reason: "response-size",
    });
  });

  it("fails before network access for invalid or non-public requests", async () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;

    await expect(reject(() => undefined)).resolves.toMatchObject({
      reason: "request",
    });
    await expect(reject(cyclic)).resolves.toMatchObject({ reason: "request" });
    await expect(reject({ ...request, locale: "fr" })).resolves.toMatchObject({
      reason: "request",
    });
    await expect(
      reject({ ...request, publicPath: "a".repeat(5000) })
    ).resolves.toMatchObject({ reason: "request-size" });
    await expect(
      reject({ ...request, delivery: "entitled" })
    ).resolves.toMatchObject({ reason: "delivery" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
