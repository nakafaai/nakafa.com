// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ContentCacheRequestSchema } from "@nakafa/aksara-contracts/cache/content";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect, Record as Rec } from "effect";
import { NextRequest } from "next/server";
import {
  ContentCacheInvalidationError,
  type invalidateContentCache,
} from "@/lib/content/cache";
import { PublishedReleaseMismatchError } from "@/lib/content/published/errors";
import { ContentStoreUnavailableError } from "@/lib/content/store/entry";
import {
  type invalidateOgCache,
  OgCacheInvalidationError,
} from "@/lib/og/cache";
import {
  type invalidateSitemapCache,
  SitemapCacheInvalidationError,
} from "@/lib/sitemap/cache";
import { encodeCacheRequest, invalidBodies, releaseId } from "@/test/cache";

const exactRequest = ContentCacheRequestSchema.make({
  scope: "material",
  releaseId,
});

const loadActiveContentIdentityMock = vi.hoisted(() => vi.fn());
const expireActiveContentIdentityMock = vi.hoisted(() => vi.fn());
const confirmActiveContentIdentityMock = vi.hoisted(() => vi.fn());
const invalidateContentCacheMock = vi.hoisted(() =>
  vi.fn<typeof invalidateContentCache>()
);
const invalidateSitemapCacheMock = vi.hoisted(() =>
  vi.fn<typeof invalidateSitemapCache>()
);
const invalidateOgCacheMock = vi.hoisted(() =>
  vi.fn<typeof invalidateOgCache>()
);

vi.mock("@/env", () => ({
  /** Provides a deterministic internal key for the route handler. */
  env: { AKSARA_PUBLICATION_TOKEN: "test-key" },
}));

vi.mock("@/lib/content/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/content/cache")>()),
  /** Records content runtime cache invalidation calls. */
  invalidateContentCache: invalidateContentCacheMock,
}));

vi.mock("@/lib/sitemap/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sitemap/cache")>()),
  /** Records the shared sitemap invalidation without calling Vercel. */
  invalidateSitemapCache: invalidateSitemapCacheMock,
}));

vi.mock("@/lib/og/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/og/cache")>()),
  /** Records the social image invalidation without calling Vercel. */
  invalidateOgCache: invalidateOgCacheMock,
}));

vi.mock("@/lib/content/published/active", () => ({
  /** Answers whether the stored release pointer names the activated release. */
  confirmActiveContentIdentity: confirmActiveContentIdentityMock,
  /** Records the expiry of the stored release pointer. */
  expireActiveContentIdentity: expireActiveContentIdentityMock,
  /** Answers the release that Convex holds right now. */
  loadActiveContentIdentity: loadActiveContentIdentityMock,
}));

beforeEach(() => {
  loadActiveContentIdentityMock.mockReset().mockReturnValue(
    Effect.succeed({
      manifestHash: `sha256:${"a".repeat(64)}`,
      releaseId,
      sequence: 1,
    })
  );
  expireActiveContentIdentityMock.mockReset().mockReturnValue(Effect.void);
  confirmActiveContentIdentityMock.mockReset().mockReturnValue(Effect.void);
  invalidateContentCacheMock
    .mockReset()
    .mockImplementation((tags) => Effect.succeed(tags));
  invalidateSitemapCacheMock.mockReset().mockReturnValue(Effect.void);
  invalidateOgCacheMock.mockReset().mockReturnValue(Effect.void);
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
        ...Rec.fromEntries(new Headers(headers)),
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
    expect(invalidateContentCacheMock).not.toHaveBeenCalled();
  });

  it("rejects an authenticated request without an exact release body", async () => {
    const { POST } = await import("@/app/api/internal/content/cache/route");

    const response = await POST(createRequest("test-key"));

    await expect(response.json()).resolves.toEqual({
      error: "Invalid cache invalidation request.",
    });
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(loadActiveContentIdentityMock).not.toHaveBeenCalled();
    expect(invalidateContentCacheMock).not.toHaveBeenCalled();
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
    loadActiveContentIdentityMock.mockReturnValueOnce(Effect.succeed(active));
    const { POST } = await import("@/app/api/internal/content/cache/route");
    const response = await POST(
      createBodyRequest(
        encodeCacheRequest({
          scope: "material",
          releaseId,
        })
      )
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Content release is not active.",
    });
    expect(loadActiveContentIdentityMock).toHaveBeenCalledTimes(1);
    expect(expireActiveContentIdentityMock).not.toHaveBeenCalled();
    expect(invalidateContentCacheMock).not.toHaveBeenCalled();
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
    expect(invalidateContentCacheMock).not.toHaveBeenCalled();
  });

  it("invalidates and echoes exactly one release-bound mutable scope", async () => {
    const { POST } = await import("@/app/api/internal/content/cache/route");
    const body = encodeCacheRequest(exactRequest);
    const response = await POST(
      createBodyRequest(body, {
        "Content-Length": String(new TextEncoder().encode(body).byteLength),
        "Content-Type": "application/json; charset=utf-8",
      })
    );

    await expect(response.json()).resolves.toEqual({
      scope: "material",
      releaseId,
      revalidated: true,
    });
    expect(response.status).toBe(200);
    expect(loadActiveContentIdentityMock).toHaveBeenCalledTimes(1);
    expect(invalidateContentCacheMock).toHaveBeenCalledWith("material");
  });

  it("expires the stored release pointer and proves it before it revalidates anything", async () => {
    const { POST } = await import("@/app/api/internal/content/cache/route");
    const response = await POST(
      createBodyRequest(encodeCacheRequest(exactRequest))
    );

    expect(response.status).toBe(200);
    expect(confirmActiveContentIdentityMock).toHaveBeenCalledExactlyOnceWith(
      releaseId
    );
    const [firstExpiry] =
      expireActiveContentIdentityMock.mock.invocationCallOrder;
    expect(firstExpiry).toBeLessThan(
      confirmActiveContentIdentityMock.mock.invocationCallOrder[0] ?? 0
    );
    expect(
      confirmActiveContentIdentityMock.mock.invocationCallOrder[0]
    ).toBeLessThan(invalidateContentCacheMock.mock.invocationCallOrder[0] ?? 0);
    expect(
      confirmActiveContentIdentityMock.mock.invocationCallOrder[0]
    ).toBeLessThan(invalidateSitemapCacheMock.mock.invocationCallOrder[0] ?? 0);
  });

  it("expires the pointer again after the sitemap purge, for a read that began before the activation", async () => {
    const { POST } = await import("@/app/api/internal/content/cache/route");
    const response = await POST(
      createBodyRequest(encodeCacheRequest(exactRequest))
    );

    expect(response.status).toBe(200);
    expect(expireActiveContentIdentityMock).toHaveBeenCalledTimes(2);
    expect(invalidateSitemapCacheMock.mock.invocationCallOrder[0]).toBeLessThan(
      expireActiveContentIdentityMock.mock.invocationCallOrder[1] ?? 0
    );
  });

  it("reports a last expiry that failed without a false receipt", async () => {
    expireActiveContentIdentityMock
      .mockReturnValueOnce(Effect.void)
      .mockReturnValueOnce(
        Effect.fail(
          new ContentStoreUnavailableError({
            cause: "offline",
            operation: "expire",
          })
        )
      );
    const { POST } = await import("@/app/api/internal/content/cache/route");
    const response = await POST(
      createBodyRequest(encodeCacheRequest(exactRequest))
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Content cache invalidation failed.",
    });
  });

  it("answers 503 and revalidates nothing when the expiry did not reach the pointer", async () => {
    // The Runtime Cache client resolves an expiry that failed, so the pointer
    // still names the previous release and only the read back can tell.
    confirmActiveContentIdentityMock.mockReturnValueOnce(
      Effect.fail(
        new PublishedReleaseMismatchError({
          actualReleaseId: ReleaseIdSchema.make("release-previous"),
          expectedReleaseId: releaseId,
        })
      )
    );
    const { POST } = await import("@/app/api/internal/content/cache/route");
    const response = await POST(
      createBodyRequest(encodeCacheRequest(exactRequest))
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Content cache invalidation failed.",
    });
    expect(invalidateContentCacheMock).not.toHaveBeenCalled();
    expect(invalidateSitemapCacheMock).not.toHaveBeenCalled();
  });

  it("reports a pointer that could not be expired without a false receipt", async () => {
    expireActiveContentIdentityMock.mockReturnValueOnce(
      Effect.fail(
        new ContentStoreUnavailableError({
          cause: "offline",
          operation: "expire",
        })
      )
    );
    const { POST } = await import("@/app/api/internal/content/cache/route");
    const response = await POST(
      createBodyRequest(encodeCacheRequest(exactRequest))
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Content cache invalidation failed.",
    });
    expect(invalidateContentCacheMock).not.toHaveBeenCalled();
    expect(invalidateSitemapCacheMock).not.toHaveBeenCalled();
  });

  it("reports a typed cache invalidation failure without a false receipt", async () => {
    invalidateContentCacheMock.mockReturnValueOnce(
      Effect.fail(new ContentCacheInvalidationError())
    );
    const { POST } = await import("@/app/api/internal/content/cache/route");
    const response = await POST(
      createBodyRequest(encodeCacheRequest(exactRequest))
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Content cache invalidation failed.",
    });
    expect(invalidateContentCacheMock).toHaveBeenCalledWith("material");
  });

  it("invalidates the sitemap once after the content cache succeeds", async () => {
    const { POST } = await import("@/app/api/internal/content/cache/route");
    const response = await POST(
      createBodyRequest(encodeCacheRequest(exactRequest))
    );

    expect(response.status).toBe(200);
    expect(invalidateSitemapCacheMock).toHaveBeenCalledExactlyOnceWith(
      releaseId
    );
  });

  it("reports a failed sitemap invalidation without a false receipt", async () => {
    invalidateSitemapCacheMock.mockReturnValueOnce(
      Effect.fail(new SitemapCacheInvalidationError())
    );
    const { POST } = await import("@/app/api/internal/content/cache/route");
    const response = await POST(
      createBodyRequest(encodeCacheRequest(exactRequest))
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Content cache invalidation failed.",
    });
  });

  it("purges the social images once, after the sitemap", async () => {
    const { POST } = await import("@/app/api/internal/content/cache/route");
    const response = await POST(
      createBodyRequest(encodeCacheRequest(exactRequest))
    );

    expect(response.status).toBe(200);
    expect(invalidateOgCacheMock).toHaveBeenCalledExactlyOnceWith(releaseId);
    expect(invalidateSitemapCacheMock.mock.invocationCallOrder[0]).toBeLessThan(
      invalidateOgCacheMock.mock.invocationCallOrder[0] ?? 0
    );
  });

  it("answers with a receipt when the social images could not be purged", async () => {
    invalidateOgCacheMock.mockReturnValueOnce(
      Effect.fail(new OgCacheInvalidationError())
    );
    const { POST } = await import("@/app/api/internal/content/cache/route");
    const response = await POST(
      createBodyRequest(encodeCacheRequest(exactRequest))
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      scope: "material",
      releaseId,
      revalidated: true,
    });
    expect(expireActiveContentIdentityMock).toHaveBeenCalledTimes(2);
  });

  it("skips the sitemap when the content cache invalidation fails", async () => {
    invalidateContentCacheMock.mockReturnValueOnce(
      Effect.fail(new ContentCacheInvalidationError())
    );
    const { POST } = await import("@/app/api/internal/content/cache/route");
    const response = await POST(
      createBodyRequest(encodeCacheRequest(exactRequest))
    );

    expect(response.status).toBe(503);
    expect(invalidateSitemapCacheMock).not.toHaveBeenCalled();
  });

  it.each(invalidBodies)(
    "rejects an invalid scoped body",
    async (body, headers, status) => {
      const { POST } = await import("@/app/api/internal/content/cache/route");
      const response = await POST(createBodyRequest(body, headers));

      expect(response.status).toBe(status);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      await expect(response.json()).resolves.toEqual({
        error: "Invalid cache invalidation request.",
      });
      expect(invalidateContentCacheMock).not.toHaveBeenCalled();
    }
  );

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
    expect(invalidateContentCacheMock).not.toHaveBeenCalled();
  });
});
