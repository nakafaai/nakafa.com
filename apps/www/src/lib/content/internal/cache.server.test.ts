// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ContentCacheRequestSchema } from "@nakafa/aksara-contracts/cache/content";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { BodyReadError } from "@repo/utilities/body";
import { Effect } from "effect";
import { receiveContentCache } from "@/lib/content/internal/cache.server";
import { PublishedReleaseMismatchError } from "@/lib/content/published/errors";
import { encodeCacheRequest, invalidBodies, releaseId } from "@/test/cache";

const CACHE_URL = "https://nakafa.com/api/internal/content/cache";
const exactBody = encodeCacheRequest(
  ContentCacheRequestSchema.make({ scope: "material", releaseId })
);

const loadActiveContentIdentityMock = vi.hoisted(() => vi.fn());
const expireActiveContentIdentityMock = vi.hoisted(() => vi.fn());
const confirmActiveContentIdentityMock = vi.hoisted(() => vi.fn());
const readBoundedBodyMock = vi.hoisted(() => vi.fn());

vi.mock("@repo/utilities/body", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@repo/utilities/body")>();
  /** Reads the body as the package does unless one test names a failure. */
  readBoundedBodyMock.mockImplementation(original.readBoundedBody);
  return { ...original, readBoundedBody: readBoundedBodyMock };
});

vi.mock("@/env", () => ({
  /** Provides a deterministic publication key for the receiver. */
  env: { AKSARA_PUBLICATION_TOKEN: "test-key" },
}));

vi.mock("@/lib/content/published/active", () => ({
  /** Answers whether the stored release pointer names the activated release. */
  confirmActiveContentIdentity: confirmActiveContentIdentityMock,
  /** Records the expiry of the stored release pointer. */
  expireActiveContentIdentity: expireActiveContentIdentityMock,
  /** Answers the release that Convex holds right now. */
  loadActiveContentIdentity: loadActiveContentIdentityMock,
}));

const activeIdentity = (activeReleaseId: string) => ({
  manifestHash: `sha256:${"a".repeat(64)}`,
  releaseId: activeReleaseId,
  sequence: 1,
});

beforeEach(() => {
  loadActiveContentIdentityMock
    .mockReset()
    .mockReturnValue(Effect.succeed(activeIdentity(releaseId)));
  expireActiveContentIdentityMock.mockReset().mockReturnValue(Effect.void);
  confirmActiveContentIdentityMock.mockReset().mockReturnValue(Effect.void);
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
    readBoundedBodyMock.mockReturnValueOnce(Effect.fail(new BodyReadError({})));

    const response = await postAuthorized(exactBody);

    expect(response.status).toBe(400);
  });

  it("rejects an authenticated request without a body", async () => {
    const response = await postAuthorized(null);

    expect(response.status).toBe(400);
  });
});

describe("content cache receiver release", () => {
  it("answers 409 and expires nothing when the active release differs", async () => {
    loadActiveContentIdentityMock.mockReturnValue(
      Effect.succeed(activeIdentity(ReleaseIdSchema.make("release-other")))
    );

    const response = await postAuthorized(exactBody);

    expect(response.status).toBe(409);
    expect(expireActiveContentIdentityMock).not.toHaveBeenCalled();
  });

  it("answers 409 when Convex holds no active release", async () => {
    loadActiveContentIdentityMock.mockReturnValue(Effect.succeed(null));

    const response = await postAuthorized(exactBody);

    expect(response.status).toBe(409);
  });

  it("expires the pointer, confirms the activated release, and echoes one receipt", async () => {
    const response = await postAuthorized(exactBody);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toStrictEqual({
      releaseId,
      revalidated: true,
      scope: "material",
    });
    expect(expireActiveContentIdentityMock).toHaveBeenCalledTimes(2);
    expect(confirmActiveContentIdentityMock).toHaveBeenCalledWith(releaseId);
  });

  it("answers 503 without a receipt when the pointer still names another release", async () => {
    confirmActiveContentIdentityMock.mockReturnValue(
      Effect.fail(
        new PublishedReleaseMismatchError({
          actualReleaseId: ReleaseIdSchema.make("release-other"),
          expectedReleaseId: releaseId,
        })
      )
    );

    const response = await postAuthorized(exactBody);

    expect(response.status).toBe(503);
    expect(await response.json()).toStrictEqual({
      error: "Content cache invalidation failed.",
    });
  });
});
