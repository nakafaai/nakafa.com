// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ContentCacheRequestSchema } from "@nakafa/aksara-contracts/cache/content";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import {
  ContentCacheInvalidationError,
  type invalidateContentCache,
} from "@/lib/content/cache";
import { receiveContentCache } from "@/lib/content/internal/cache.server";
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

const CACHE_URL = "https://nakafa.com/api/internal/content/cache";
const exactBody = encodeCacheRequest(
  ContentCacheRequestSchema.make({ scope: "material", releaseId })
);

const loadActiveContentIdentityMock = vi.hoisted(() => vi.fn());
const expireActiveContentIdentityMock = vi.hoisted(() => vi.fn());
const confirmActiveContentIdentityMock = vi.hoisted(() => vi.fn());
const invalidateContentCacheMock = vi.hoisted(() =>
  vi.fn<typeof invalidateContentCache>()
);
const invalidateStoreTagMock = vi.hoisted(() => vi.fn());
const invalidateSitemapCacheMock = vi.hoisted(() =>
  vi.fn<typeof invalidateSitemapCache>()
);
const invalidateOgCacheMock = vi.hoisted(() =>
  vi.fn<typeof invalidateOgCache>()
);

vi.mock("@/env", () => ({
  /** Provides a deterministic publication key for the receiver. */
  env: { AKSARA_PUBLICATION_TOKEN: "test-key" },
}));

vi.mock("@/lib/content/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/content/cache")>()),
  /** Records the content store expiry of one scope. */
  invalidateContentCache: invalidateContentCacheMock,
}));

vi.mock("@/lib/content/store/entry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/content/store/entry")>()),
  /** Records the CDN purge of one scope without calling Vercel. */
  invalidateStoreTag: invalidateStoreTagMock,
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
    .mockImplementation((scope) => Effect.succeed(scope));
  invalidateStoreTagMock.mockReset().mockReturnValue(Effect.void);
  invalidateSitemapCacheMock.mockReset().mockReturnValue(Effect.void);
  invalidateOgCacheMock.mockReset().mockReturnValue(Effect.void);
});

/** Posts one request to the receiver with the given headers and body. */
function post(body: BodyInit | null, headers: HeadersInit = {}) {
  return receiveContentCache({
    request: new Request(CACHE_URL, { body, headers, method: "POST" }),
  });
}

/** Posts one authenticated JSON body to the receiver. */
function postAuthorized(body: BodyInit | null) {
  return post(body, {
    Authorization: "Bearer test-key",
    "Content-Type": "application/json",
  });
}

describe("content cache receiver authorization", () => {
  it("rejects a missing, malformed or wrong bearer token", async () => {
    const missing = await post(exactBody, {
      "Content-Type": "application/json",
    });
    const malformed = await post(exactBody, {
      Authorization: "Basic test-key",
      "Content-Type": "application/json",
    });
    const wrong = await post(exactBody, {
      Authorization: "Bearer other-key",
      "Content-Type": "application/json",
    });

    for (const response of [missing, malformed, wrong]) {
      expect(response.status).toBe(401);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      await expect(response.json()).resolves.toEqual({
        error: "Unauthorized",
      });
    }
    expect(invalidateContentCacheMock).not.toHaveBeenCalled();
  });

  it("rejects an empty bearer token", async () => {
    const response = await post(exactBody, {
      Authorization: "Bearer ",
      "Content-Type": "application/json",
    });

    expect(response.status).toBe(401);
  });
});

describe("content cache receiver body", () => {
  it.each(invalidBodies)(
    "refuses an invalid body with a private status",
    async (body, headers, status) => {
      const response = await post(body, {
        Authorization: "Bearer test-key",
        ...headers,
      });

      expect(response.status).toBe(status);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      await expect(response.json()).resolves.toEqual({
        error: "Invalid cache invalidation request.",
      });
    }
  );

  it("maps a failed body read to a private bad request", async () => {
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error("connection reset"));
      },
    });
    const response = await receiveContentCache({
      request: new Request(CACHE_URL, {
        body,
        duplex: "half",
        headers: {
          Authorization: "Bearer test-key",
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    });

    expect(response.status).toBe(400);
    expect(invalidateContentCacheMock).not.toHaveBeenCalled();
  });

  it("rejects an authenticated request without a body", async () => {
    const response = await postAuthorized(null);

    expect(response.status).toBe(400);
    expect(invalidateContentCacheMock).not.toHaveBeenCalled();
  });
});

describe("content cache receiver release", () => {
  it("answers 409 and invalidates nothing when the active release differs", async () => {
    loadActiveContentIdentityMock.mockReturnValue(
      Effect.succeed({
        manifestHash: `sha256:${"b".repeat(64)}`,
        releaseId: ReleaseIdSchema.make("release-other"),
        sequence: 2,
      })
    );

    const response = await postAuthorized(exactBody);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Content release is not active.",
    });
    expect(invalidateContentCacheMock).not.toHaveBeenCalled();
    expect(invalidateStoreTagMock).not.toHaveBeenCalled();
  });

  it("answers 409 when Convex holds no active release", async () => {
    loadActiveContentIdentityMock.mockReturnValue(Effect.succeed(undefined));

    const response = await postAuthorized(exactBody);

    expect(response.status).toBe(409);
  });

  it("invalidates the scope in order and echoes one receipt", async () => {
    const response = await postAuthorized(exactBody);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      releaseId,
      revalidated: true,
      scope: "material",
    });
    expect(expireActiveContentIdentityMock).toHaveBeenCalledTimes(2);
    expect(confirmActiveContentIdentityMock).toHaveBeenCalledWith(releaseId);
    expect(invalidateContentCacheMock).toHaveBeenCalledWith("material");
    expect(invalidateStoreTagMock).toHaveBeenCalledWith(
      "content-scope:material"
    );
    expect(invalidateSitemapCacheMock).toHaveBeenCalledWith(releaseId);
    expect(invalidateOgCacheMock).toHaveBeenCalledWith(releaseId);
  });

  it("confirms the pointer before any purge runs", async () => {
    confirmActiveContentIdentityMock.mockReturnValue(
      Effect.fail(
        new PublishedReleaseMismatchError({
          actualReleaseId: ReleaseIdSchema.make("release-old"),
          expectedReleaseId: releaseId,
        })
      )
    );

    const response = await postAuthorized(exactBody);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Content cache invalidation failed.",
    });
    expect(invalidateContentCacheMock).not.toHaveBeenCalled();
    expect(invalidateStoreTagMock).not.toHaveBeenCalled();
  });

  it("answers 503 without a receipt when the pointer expiry fails", async () => {
    expireActiveContentIdentityMock.mockReturnValue(
      Effect.fail(
        new ContentStoreUnavailableError({ cause: "down", operation: "expire" })
      )
    );

    const response = await postAuthorized(exactBody);

    expect(response.status).toBe(503);
    expect(invalidateSitemapCacheMock).not.toHaveBeenCalled();
  });

  it("answers 503 without a receipt when the store expiry fails", async () => {
    invalidateContentCacheMock.mockReturnValue(
      Effect.fail(new ContentCacheInvalidationError())
    );

    const response = await postAuthorized(exactBody);

    expect(response.status).toBe(503);
    expect(invalidateStoreTagMock).not.toHaveBeenCalled();
    expect(invalidateSitemapCacheMock).not.toHaveBeenCalled();
  });

  it("answers 503 without a receipt when the CDN purge fails", async () => {
    invalidateStoreTagMock.mockReturnValue(
      Effect.fail(
        new ContentStoreUnavailableError({
          cause: "offline",
          operation: "invalidate",
        })
      )
    );

    const response = await postAuthorized(exactBody);

    expect(response.status).toBe(503);
    expect(invalidateSitemapCacheMock).not.toHaveBeenCalled();
  });

  it("answers 503 without a receipt when the sitemap purge fails", async () => {
    invalidateSitemapCacheMock.mockReturnValue(
      Effect.fail(new SitemapCacheInvalidationError())
    );

    const response = await postAuthorized(exactBody);

    expect(response.status).toBe(503);
    expect(invalidateOgCacheMock).not.toHaveBeenCalled();
  });

  it("answers with a receipt when the social images could not be purged", async () => {
    invalidateOgCacheMock.mockReturnValue(
      Effect.fail(new OgCacheInvalidationError())
    );

    const response = await postAuthorized(exactBody);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      releaseId,
      revalidated: true,
      scope: "material",
    });
  });
});
