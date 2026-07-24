// @vitest-environment node

import { readTryoutContent } from "@repo/backend/client/content/tryout";
import { testSignedArtifact } from "@repo/backend/test/content-proof";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const endpoint = "https://example.convex.site/internal/tryouts/content";
const target = {
  siteUrl: "https://example.convex.site/ignored/path",
  token: "runtime-test-token",
  userToken: "user-jwt",
};
const request = {
  countryKey: "indonesia",
  examKey: "snbt",
  locale: "id",
  sectionKey: "penalaran-matematika",
  setKey: "set-1",
  trackKey: "2027",
} as const;
const fetchMock = vi.hoisted(() => vi.fn<typeof fetch>());

vi.mock("server-only", () => ({}));

/** Creates one response with the immutable network URL populated. */
function createResponse(body: unknown, status: number) {
  const response = new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json; charset=utf-8" },
    status,
  });
  Object.defineProperty(response, "url", { value: endpoint });
  return response;
}

/** Executes one private content request at the test boundary. */
function execute(input: unknown = request) {
  return Effect.runPromise(readTryoutContent(target, input));
}

/** Exposes one private content failure value at the test boundary. */
function reject(input: unknown = request) {
  return Effect.runPromise(readTryoutContent(target, input).pipe(Effect.flip));
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("private try-out content request", () => {
  it("posts both server and user credentials without exposing cacheable state", async () => {
    fetchMock.mockResolvedValue(createResponse({ kind: "unavailable" }, 200));

    await expect(execute()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        body: JSON.stringify(request),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${target.userToken}`,
          "Content-Type": "application/json",
          "x-nakafa-content-token": target.token,
        },
        method: "POST",
        redirect: "error",
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("decodes placement-bound signed artifacts", async () => {
    const questionArtifact = testSignedArtifact("snbt-math");
    fetchMock.mockResolvedValue(
      createResponse(
        {
          artifacts: [
            {
              placementId: "placement-1",
              questionArtifact,
            },
          ],
          kind: "found",
        },
        200
      )
    );

    await expect(execute()).resolves.toMatchObject({
      artifacts: [
        {
          placementId: "placement-1",
          questionArtifact: {
            artifactHash: questionArtifact.artifactHash,
          },
        },
      ],
      kind: "found",
    });
  });

  it.each([
    ["TRYOUT_CONTENT_UNAUTHORIZED", 401],
    ["TRYOUT_CONTENT_INTERNAL", 500],
    ["TRYOUT_CONTENT_INVALID", 400],
    ["TRYOUT_CONTENT_INVALID", 413],
    ["TRYOUT_CONTENT_INVALID", 415],
  ] as const)("maps %s at %i to the typed failure", async (code, status) => {
    fetchMock.mockResolvedValue(
      createResponse({ code, kind: "failure" }, status)
    );

    await expect(reject()).resolves.toMatchObject({
      _tag: "TryoutContentFailureError",
      code,
      status,
    });
  });

  it("rejects invalid requests, response contracts, and status pairs", async () => {
    await expect(reject({ ...request, locale: "de" })).resolves.toMatchObject({
      reason: "request",
    });
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(createResponse({ kind: "unknown" }, 200));
    await expect(reject()).resolves.toMatchObject({ reason: "json" });

    fetchMock.mockResolvedValueOnce(
      createResponse({ kind: "unavailable" }, 404)
    );
    await expect(reject()).resolves.toMatchObject({ reason: "status" });
  });
});
