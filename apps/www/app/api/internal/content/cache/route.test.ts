// @vitest-environment node

import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const revalidateContentRuntimeCacheMock = vi.hoisted(() =>
  vi.fn(() => ["content-runtime"])
);

vi.mock("@/env", () => ({
  /** Provides a deterministic internal key for the route handler. */
  env: { INTERNAL_CONTENT_API_KEY: "test-key" },
}));

vi.mock("@/lib/content/cache", () => ({
  /** Records content runtime cache invalidation calls. */
  revalidateContentRuntimeCache: revalidateContentRuntimeCacheMock,
}));

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

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(malformed.status).toBe(401);
    expect(revalidateContentRuntimeCacheMock).not.toHaveBeenCalled();
  });

  it("invalidates the content runtime cache for trusted sync scripts", async () => {
    const { POST } = await import("@/app/api/internal/content/cache/route");

    const response = await POST(createRequest("test-key"));

    await expect(response.json()).resolves.toEqual({
      revalidated: true,
      tags: ["content-runtime"],
    });
    expect(response.status).toBe(200);
    expect(revalidateContentRuntimeCacheMock).toHaveBeenCalledTimes(1);
  });
});
