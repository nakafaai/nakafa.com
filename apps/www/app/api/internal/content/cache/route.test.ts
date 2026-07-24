// @vitest-environment node

import {
  makeArtifactCacheTag,
  makeContentCacheRequest,
} from "@nakafa/aksara-contracts/cache/content";
import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const releaseId = ReleaseIdSchema.make("release-cache-test");
const artifactHash = Sha256HashSchema.make(`sha256:${"a".repeat(64)}`);
const artifactTag = makeArtifactCacheTag(artifactHash);
const exactRequest = makeContentCacheRequest({
  artifactHashes: [artifactHash],
  family: "material",
  releaseId,
});
const exactTags = exactRequest.tags;
const readActiveContentIdentityMock = vi.hoisted(() => vi.fn());
const revalidateContentCacheMock = vi.hoisted(() =>
  vi.fn((tags: readonly string[]) => tags)
);

vi.mock("@/env", () => ({
  /** Provides a deterministic internal key for the route handler. */
  env: { INTERNAL_CONTENT_API_KEY: "test-key" },
}));

vi.mock("@/lib/content/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/content/cache")>()),
  /** Records content runtime cache invalidation calls. */
  revalidateContentCache: revalidateContentCacheMock,
}));

vi.mock("@/lib/content/published/active", () => ({
  readActiveContentIdentity: readActiveContentIdentityMock,
}));

beforeEach(() => {
  readActiveContentIdentityMock.mockReset().mockReturnValue(
    Effect.succeed({
      manifestHash: `sha256:${"a".repeat(64)}`,
      releaseId,
      sequence: 1,
    })
  );
  revalidateContentCacheMock.mockClear();
});

/** Creates one Next POST request for the cache route. */
function createRequestWithAuthorization(authorization: string | undefined) {
  const headers = new Headers();

  if (authorization !== undefined) {
    headers.set("Authorization", authorization);
  }

  return new NextRequest("https://nakafa.com/api/internal/content/cache", {
    method: "POST",
    headers,
  });
}

/** Creates one authenticated request with an explicit invalidation body. */
function createBodyRequest(
  body: BodyInit,
  headers: HeadersInit = { "Content-Type": "application/json" }
) {
  const request = new NextRequest(
    "https://nakafa.com/api/internal/content/cache",
    {
      body,
      headers: {
        Authorization: "Bearer test-key",
        ...Object.fromEntries(new Headers(headers)),
      },
      method: "POST",
    }
  );
  if (!new Headers(headers).has("Content-Type")) {
    request.headers.delete("Content-Type");
  }

  return request;
}

/** Creates one authenticated Next POST request for the cache route. */
function createRequest(token: string | undefined) {
  const authorization = token === undefined ? undefined : `Bearer ${token}`;

  return createRequestWithAuthorization(authorization);
}

describe("content runtime cache revalidation route", () => {
  it("rejects missing and invalid internal bearer tokens", async () => {
    const { POST } = await import("@/app/api/internal/content/cache/route");

    const missing = await POST(createRequest(undefined));
    const invalid = await POST(createRequest("wrong-key"));
    const malformed = await POST(createRequestWithAuthorization("Basic key"));
    const empty = await POST(createRequestWithAuthorization("Bearer "));

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(malformed.status).toBe(401);
    expect(empty.status).toBe(401);
    expect(missing.headers.get("Cache-Control")).toBe("private, no-store");
    expect(invalid.headers.get("Cache-Control")).toBe("private, no-store");
    expect(malformed.headers.get("Cache-Control")).toBe("private, no-store");
    expect(revalidateContentCacheMock).not.toHaveBeenCalled();
  });

  it("rejects an authenticated request without an exact release body", async () => {
    const { POST } = await import("@/app/api/internal/content/cache/route");

    const response = await POST(createRequest("test-key"));

    await expect(response.json()).resolves.toEqual({
      error: "Invalid cache invalidation request.",
    });
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(readActiveContentIdentityMock).not.toHaveBeenCalled();
    expect(revalidateContentCacheMock).not.toHaveBeenCalled();
  });

  it.each([
    [
      "different Convex environment",
      {
        manifestHash: `sha256:${"b".repeat(64)}`,
        releaseId: ReleaseIdSchema.make("release-other-environment"),
        sequence: 2,
      },
    ],
    ["environment without an active release", null],
  ])("rejects a release from a %s", async (_kind, active) => {
    readActiveContentIdentityMock.mockReturnValueOnce(Effect.succeed(active));
    const { POST } = await import("@/app/api/internal/content/cache/route");
    const response = await POST(
      createBodyRequest(
        JSON.stringify({
          family: "material",
          releaseId,
          tags: ["content-runtime", "content-family:material"],
        })
      )
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Content release is not active.",
    });
    expect(readActiveContentIdentityMock).toHaveBeenCalledTimes(1);
    expect(revalidateContentCacheMock).not.toHaveBeenCalled();
  });

  it("rejects a declared body that is absent", async () => {
    const { POST } = await import("@/app/api/internal/content/cache/route");
    const request = createRequest("test-key");
    request.headers.set("Content-Length", "1");
    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid cache invalidation request.",
    });
    expect(revalidateContentCacheMock).not.toHaveBeenCalled();
  });

  it("invalidates and echoes the exact release artifact tags", async () => {
    const { POST } = await import("@/app/api/internal/content/cache/route");
    const body = JSON.stringify(exactRequest);
    const response = await POST(
      createBodyRequest(body, {
        "Content-Length": String(new TextEncoder().encode(body).byteLength),
        "Content-Type": "application/json; charset=utf-8",
      })
    );

    await expect(response.json()).resolves.toEqual({
      family: "material",
      releaseId,
      revalidated: true,
      tags: exactTags,
    });
    expect(response.status).toBe(200);
    expect(readActiveContentIdentityMock).toHaveBeenCalledTimes(1);
    expect(revalidateContentCacheMock).toHaveBeenCalledWith(exactTags);
  });

  it.each([
    ["{", { "Content-Type": "application/json" }, 400],
    [
      JSON.stringify({
        extra: true,
        family: "material",
        releaseId,
        tags: ["content-runtime", "content-family:material"],
      }),
      { "Content-Type": "application/json" },
      400,
    ],
    [
      JSON.stringify({
        family: "material",
        releaseId,
        tags: ["unknown"],
      }),
      { "Content-Type": "application/json" },
      400,
    ],
    [
      JSON.stringify({
        releaseId,
        family: "material",
        tags: ["content-family:material", "content-runtime"],
      }),
      { "Content-Type": "application/json" },
      400,
    ],
    [
      JSON.stringify({
        releaseId,
        family: "material",
        tags: [
          "content-runtime",
          "content-family:material",
          ...Array.from({ length: 99 }, () => artifactTag),
        ],
      }),
      { "Content-Type": "application/json" },
      400,
    ],
    [
      JSON.stringify({
        family: "material",
        releaseId,
        tags: ["content-runtime", "content-family:material"],
      }),
      { "Content-Type": "text/plain" },
      415,
    ],
    [
      JSON.stringify({
        family: "material",
        releaseId,
        tags: ["content-runtime", "content-family:material"],
      }),
      {},
      415,
    ],
    [new Uint8Array(), { "Content-Type": "application/json" }, 400],
    ["{}", { "Content-Length": "invalid" }, 413],
    ["{}", { "Content-Length": "-1" }, 413],
    ["{}", { "Content-Length": "9".repeat(400) }, 413],
    ["{}", { "Content-Length": String(32 * 1024 + 1) }, 413],
    ["{}", { "Content-Length": "3", "Content-Type": "application/json" }, 400],
    [new Uint8Array([255]), { "Content-Type": "application/json" }, 400],
    ["x".repeat(32 * 1024 + 1), { "Content-Type": "application/json" }, 413],
  ] as const)("rejects an invalid exact-tag body", async (body, headers, status) => {
    const { POST } = await import("@/app/api/internal/content/cache/route");
    const response = await POST(createBodyRequest(body, headers));

    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      error: "Invalid cache invalidation request.",
    });
    expect(revalidateContentCacheMock).not.toHaveBeenCalled();
  });

  it("maps a body read failure to a private bad request", async () => {
    const { POST } = await import("@/app/api/internal/content/cache/route");
    const request = createBodyRequest(
      new ReadableStream<Uint8Array>({
        /** Fails before exposing any request bytes. */
        pull(controller) {
          controller.error(new TypeError("unreadable"));
        },
      })
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(revalidateContentCacheMock).not.toHaveBeenCalled();
  });
});
