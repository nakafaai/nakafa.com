// @vitest-environment node

import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { MAX_PUBLIC_RUNTIME_RESPONSE_BYTES } from "@nakafa/aksara-contracts/runtime/spec";
import { verifyContentRuntimeExchange } from "@nakafa/aksara-contracts/runtime/verify";
import {
  ContentRuntimeFailureError,
  ContentRuntimeMissingError,
  ContentRuntimeVerificationError,
  ContentTransportError,
} from "@repo/backend/client/content/errors";
import {
  readPublicContent,
  readPublicContentEvidence,
  readPublicContentEvidenceBatch,
} from "@repo/backend/client/content/public";
import {
  CONTENT_RUNTIME_RESPONSE_HEADER,
  CONTENT_RUNTIME_RESPONSE_MARKER,
  PUBLIC_CONTENT_RUNTIME_BATCH_PATH,
} from "@repo/backend/content/endpoint";
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
const batchEndpoint = `https://example.convex.site${PUBLIC_CONTENT_RUNTIME_BATCH_PATH}`;
const target = {
  siteUrl: "https://example.convex.site/ignored/path",
  token: "runtime-test-token",
};
const input = {
  appLocale: AppLocaleSchema.make("en"),
  publicPath: PublicPathSchema.make("test/head-0"),
};
const fetchMock = vi.hoisted(() => vi.fn<typeof fetch>());
const verifyMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@nakafa/aksara-contracts/runtime/verify", () => ({
  verifyContentRuntimeExchange: verifyMock,
}));

/** Creates one response with the immutable network URL populated. */
function createResponse(
  body: unknown,
  status: number,
  marked = true,
  responseEndpoint = endpoint
) {
  const headers = new Headers({ "content-type": "application/json" });
  if (marked) {
    headers.set(
      CONTENT_RUNTIME_RESPONSE_HEADER,
      CONTENT_RUNTIME_RESPONSE_MARKER
    );
  }
  const response = new Response(JSON.stringify(body), {
    headers,
    status,
  });
  Object.defineProperty(response, "url", { value: responseEndpoint });
  return response;
}

/** Creates one structurally complete public found response. */
function foundResponse(title?: string) {
  return {
    activeManifestHash: TEST_MANIFEST_HASH,
    activeReleaseId: TEST_RELEASE_ID,
    artifact: JSON.parse(testArtifactJson()),
    delivery: "public",
    kind: "found",
    projection: JSON.parse(testProjectionJson({ title })),
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
    fetchMock.mockResolvedValue(createResponse(found, 200, false));

    await expect(
      Effect.runPromise(
        readPublicContent(target, input, found.rendererManifest)
      )
    ).resolves.toMatchObject({ kind: "found" });
    expect(fetchMock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        body: JSON.stringify({
          appLocale: input.appLocale,
          delivery: "public",
          publicPath: input.publicPath,
        }),
      })
    );
    expect(verifyContentRuntimeExchange).toHaveBeenCalledOnce();
  });

  it("posts one ordered eight-item batch without singular fallback", async () => {
    const found = foundResponse();
    const inputs = Array.from({ length: 8 }, (_, index) => ({
      appLocale: input.appLocale,
      publicPath: `test/head-${index}`,
    }));
    fetchMock.mockResolvedValue(
      createResponse(
        { responses: Array.from({ length: 8 }, () => found) },
        200,
        true,
        batchEndpoint
      )
    );

    await expect(
      Effect.runPromise(readPublicContentEvidenceBatch(target, inputs))
    ).resolves.toHaveLength(8);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      batchEndpoint,
      expect.objectContaining({
        body: JSON.stringify({
          requests: inputs.map(({ appLocale, publicPath }) => ({
            appLocale,
            delivery: "public",
            publicPath,
          })),
        }),
      })
    );
    expect(verifyMock).toHaveBeenCalledTimes(8);
    expect(
      verifyMock.mock.calls.map(([exchange]) => exchange.request.publicPath)
    ).toEqual(inputs.map(({ publicPath }) => publicPath));
  });

  it("rejects more than eight requests before making a network call", async () => {
    const inputs = Array.from({ length: 9 }, (_, index) => ({
      appLocale: input.appLocale,
      publicPath: `test/head-${index}`,
    }));

    await expect(
      Effect.runPromise(
        readPublicContentEvidenceBatch(target, inputs).pipe(Effect.flip)
      )
    ).resolves.toEqual(new ContentTransportError({ reason: "request" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it("preserves exact item absence and batch-level runtime failure", async () => {
    fetchMock
      .mockResolvedValueOnce(
        createResponse(
          { responses: [{ kind: "missing" }] },
          200,
          true,
          batchEndpoint
        )
      )
      .mockResolvedValueOnce(
        createResponse(
          { code: "CONTENT_RUNTIME_INTERNAL", kind: "failure" },
          500,
          true,
          batchEndpoint
        )
      );

    await expect(
      Effect.runPromise(
        readPublicContentEvidenceBatch(target, [input]).pipe(Effect.flip)
      )
    ).resolves.toEqual(
      new ContentRuntimeMissingError({
        request: { delivery: "public", ...input },
      })
    );
    await expect(
      Effect.runPromise(
        readPublicContentEvidenceBatch(target, [input]).pipe(Effect.flip)
      )
    ).resolves.toEqual(
      new ContentRuntimeFailureError({
        code: "CONTENT_RUNTIME_INTERNAL",
        status: 500,
      })
    );
  });

  it("rejects a response with different batch cardinality", async () => {
    const inputs = [input, { ...input, publicPath: "test/second-head" }];
    fetchMock.mockResolvedValue(
      createResponse({ responses: [foundResponse()] }, 200, true, batchEndpoint)
    );

    await expect(
      Effect.runPromise(
        readPublicContentEvidenceBatch(target, inputs).pipe(Effect.flip)
      )
    ).resolves.toEqual(
      new ContentTransportError({ reason: "response-contract" })
    );
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it("rejects one batch item above the Aksara singular byte ceiling", async () => {
    const oversized = foundResponse(
      "x".repeat(MAX_PUBLIC_RUNTIME_RESPONSE_BYTES)
    );
    fetchMock.mockResolvedValue(
      createResponse({ responses: [oversized] }, 200, true, batchEndpoint)
    );

    await expect(
      Effect.runPromise(
        readPublicContentEvidenceBatch(target, [input]).pipe(Effect.flip)
      )
    ).resolves.toEqual(
      new ContentTransportError({ reason: "response-contract" })
    );
    expect(verifyMock).not.toHaveBeenCalled();
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

  it("classifies valid JSON outside the public response contract", async () => {
    fetchMock
      .mockResolvedValueOnce(createResponse({ unexpected: true }, 200, false))
      .mockResolvedValueOnce(createResponse({ unexpected: true }, 200));

    await expect(
      Effect.runPromise(
        readPublicContentEvidence(target, input).pipe(Effect.flip)
      )
    ).resolves.toEqual(
      new ContentTransportError({ reason: "response-unmarked" })
    );
    await expect(
      Effect.runPromise(
        readPublicContentEvidence(target, input).pipe(Effect.flip)
      )
    ).resolves.toEqual(
      new ContentTransportError({ reason: "response-contract" })
    );
    expect(verifyContentRuntimeExchange).not.toHaveBeenCalled();
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
