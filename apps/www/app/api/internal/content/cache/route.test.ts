// @vitest-environment node

import { MATERIAL_CACHE_TAGS } from "@nakafa/aksara-contracts/cache/material";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const releaseId = ReleaseIdSchema.make("release-cache-test");
const readActiveContentIdentityMock = vi.hoisted(() => vi.fn());
const revalidateMaterialCacheMock = vi.hoisted(() =>
  vi.fn(() => MATERIAL_CACHE_TAGS)
);

vi.mock("@/env", () => ({
  /** Provides a deterministic internal key for the route handler. */
  env: { INTERNAL_CONTENT_API_KEY: "test-key" },
}));

vi.mock("@/lib/content/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/content/cache")>()),
  /** Records content runtime cache invalidation calls. */
  revalidateMaterialCache: revalidateMaterialCacheMock,
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
  revalidateMaterialCacheMock.mockClear();
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
    expect(revalidateMaterialCacheMock).not.toHaveBeenCalled();
  });

  it("invalidates the content runtime cache for trusted sync scripts", async () => {
    const { POST } = await import("@/app/api/internal/content/cache/route");

    const response = await POST(createRequest("test-key"));

    await expect(response.json()).resolves.toEqual({
      revalidated: true,
      tags: MATERIAL_CACHE_TAGS,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(readActiveContentIdentityMock).not.toHaveBeenCalled();
    expect(revalidateMaterialCacheMock).toHaveBeenCalledTimes(1);
  });

  it("preserves an explicitly empty JSON full-sync body", async () => {
    const { POST } = await import("@/app/api/internal/content/cache/route");
    const response = await POST(
      createBodyRequest("", {
        "Content-Length": "0",
        "Content-Type": "application/json",
      })
    );

    await expect(response.json()).resolves.toEqual({
      revalidated: true,
      tags: MATERIAL_CACHE_TAGS,
    });
    expect(response.status).toBe(200);
    expect(readActiveContentIdentityMock).not.toHaveBeenCalled();
    expect(revalidateMaterialCacheMock).toHaveBeenCalledTimes(1);
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
        JSON.stringify({ releaseId, tags: MATERIAL_CACHE_TAGS })
      )
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Content release is not active.",
    });
    expect(readActiveContentIdentityMock).toHaveBeenCalledTimes(1);
    expect(revalidateMaterialCacheMock).not.toHaveBeenCalled();
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
    expect(revalidateMaterialCacheMock).not.toHaveBeenCalled();
  });

  it("echoes the exact release bound to the shared material tags", async () => {
    const { POST } = await import("@/app/api/internal/content/cache/route");
    const body = JSON.stringify({ releaseId, tags: MATERIAL_CACHE_TAGS });
    const response = await POST(
      createBodyRequest(body, {
        "Content-Length": String(new TextEncoder().encode(body).byteLength),
        "Content-Type": "application/json; charset=utf-8",
      })
    );

    await expect(response.json()).resolves.toEqual({
      releaseId,
      revalidated: true,
      tags: MATERIAL_CACHE_TAGS,
    });
    expect(response.status).toBe(200);
    expect(readActiveContentIdentityMock).toHaveBeenCalledTimes(1);
    expect(revalidateMaterialCacheMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["{", { "Content-Type": "application/json" }, 400],
    [
      JSON.stringify({
        extra: true,
        releaseId,
        tags: MATERIAL_CACHE_TAGS,
      }),
      { "Content-Type": "application/json" },
      400,
    ],
    [
      JSON.stringify({ releaseId, tags: ["unknown"] }),
      { "Content-Type": "application/json" },
      400,
    ],
    [
      JSON.stringify({ releaseId, tags: [...MATERIAL_CACHE_TAGS].reverse() }),
      { "Content-Type": "application/json" },
      400,
    ],
    [
      JSON.stringify({ releaseId, tags: MATERIAL_CACHE_TAGS }),
      { "Content-Type": "text/plain" },
      415,
    ],
    [JSON.stringify({ releaseId, tags: MATERIAL_CACHE_TAGS }), {}, 415],
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
    expect(revalidateMaterialCacheMock).not.toHaveBeenCalled();
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
    expect(revalidateMaterialCacheMock).not.toHaveBeenCalled();
  });
});
