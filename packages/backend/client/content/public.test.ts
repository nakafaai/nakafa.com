// @vitest-environment node

import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { verifyContentRuntimeExchange } from "@nakafa/aksara-contracts/runtime/verify";
import {
  ContentRuntimeFailureError,
  ContentRuntimeMissingError,
  ContentRuntimeVerificationError,
} from "@repo/backend/client/content/errors";
import {
  readPublicContent,
  readPublicContentEvidence,
} from "@repo/backend/client/content/public";
import { testArtifactJson } from "@repo/backend/test/content-artifact";
import { testProjectionJson } from "@repo/backend/test/content-material";
import {
  TEST_DIGEST,
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
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
const input = {
  locale: "en" as const,
  publicPath: PublicPathSchema.make("test/head-0"),
};
const fetchMock = vi.hoisted(() => vi.fn<typeof fetch>());
const verifyMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@nakafa/aksara-contracts/runtime/verify", () => ({
  verifyContentRuntimeExchange: verifyMock,
}));

/** Creates one response with the immutable network URL populated. */
function createResponse(body: unknown, status: number) {
  const response = new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
  Object.defineProperty(response, "url", { value: endpoint });
  return response;
}

/** Creates one structurally complete public found response. */
function foundResponse() {
  return {
    activeManifestHash: TEST_MANIFEST_HASH,
    activeReleaseId: TEST_RELEASE_ID,
    artifact: JSON.parse(testArtifactJson()),
    delivery: "public",
    kind: "found",
    projection: JSON.parse(testProjectionJson()),
    projectionHash: TEST_DIGEST,
    release: JSON.parse(testReleaseJson()),
    rendererManifest: JSON.parse(testRendererJson()),
    sourcePath: "packages/corpus/test/head-0/en.mdx",
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  verifyMock.mockReset();
  verifyMock.mockImplementation(({ response }) => Effect.succeed(response));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("public content runtime client", () => {
  it("posts, verifies, and returns one active public artifact", async () => {
    const found = foundResponse();
    fetchMock.mockResolvedValue(createResponse(found, 200));

    await expect(
      Effect.runPromise(
        readPublicContent(target, input, found.rendererManifest)
      )
    ).resolves.toMatchObject({ kind: "found" });
    expect(fetchMock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        body: JSON.stringify({ delivery: "public", ...input }),
      })
    );
    expect(verifyContentRuntimeExchange).toHaveBeenCalledOnce();
  });

  it("distinguishes exact absence from sanitized runtime failure", async () => {
    fetchMock
      .mockResolvedValueOnce(createResponse({ kind: "missing" }, 404))
      .mockResolvedValueOnce(
        createResponse(
          { code: "CONTENT_RUNTIME_INTERNAL", kind: "failure" },
          500
        )
      );

    await expect(
      Effect.runPromise(
        readPublicContentEvidence(target, input).pipe(Effect.flip)
      )
    ).resolves.toEqual(
      new ContentRuntimeMissingError({
        request: { delivery: "public", ...input },
      })
    );
    await expect(
      Effect.runPromise(
        readPublicContentEvidence(target, input).pipe(Effect.flip)
      )
    ).resolves.toEqual(
      new ContentRuntimeFailureError({
        code: "CONTENT_RUNTIME_INTERNAL",
        status: 500,
      })
    );
  });

  it("preserves signature failures in the typed verification boundary", async () => {
    const cause = new Error("signature mismatch");
    fetchMock.mockResolvedValue(createResponse(foundResponse(), 200));
    verifyMock.mockReturnValue(Effect.fail(cause));

    await expect(
      Effect.runPromise(
        readPublicContent(target, input, foundResponse().rendererManifest).pipe(
          Effect.flip
        )
      )
    ).resolves.toEqual(new ContentRuntimeVerificationError({ cause }));
  });
});
