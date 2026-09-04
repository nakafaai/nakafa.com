// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
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
import { readMaterialContent } from "@repo/backend/client/content/material";
import {
  CONTENT_RUNTIME_RESPONSE_HEADER,
  CONTENT_RUNTIME_RESPONSE_MARKER,
  MATERIAL_CONTENT_RUNTIME_PATH,
} from "@repo/backend/content/endpoint";
import { testArtifactJson } from "@repo/backend/test/content/artifact";
import { testProjectionJson } from "@repo/backend/test/content/material";
import {
  TEST_DIGEST,
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
  testReleaseJson,
  testRendererJson,
} from "@repo/backend/test/content/release";
import { Effect } from "effect";

const endpoint = `https://example.convex.site${MATERIAL_CONTENT_RUNTIME_PATH}`;
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

/** Creates one marked response with an immutable network URL. */
function createResponse(body: unknown, status: number, marked = true) {
  const headers = new Headers({ "content-type": "application/json" });
  if (marked) {
    headers.set(
      CONTENT_RUNTIME_RESPONSE_HEADER,
      CONTENT_RUNTIME_RESPONSE_MARKER
    );
  }
  const response = new Response(JSON.stringify(body), { headers, status });
  Object.defineProperty(response, "url", { value: endpoint });
  return response;
}

/** Creates one structurally complete nested public runtime. */
function runtimeResponse() {
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

/** Creates the complete shell paired with the nested runtime fixture. */
function materialResponse() {
  return {
    kind: "found",
    model: {
      activeManifestHash: TEST_MANIFEST_HASH,
      activeAppLocales: ["en", "id", "de"],
      activeReleaseId: TEST_RELEASE_ID,
      alternateJson: [testProjectionJson()],
      projectionJson: testProjectionJson(),
      rendererDomain: "mathematics",
      siblingJson: [testProjectionJson()],
      sourcePath: "packages/corpus/test/head-0/en.mdx",
      sourceRevision: "a".repeat(40),
    },
    runtime: runtimeResponse(),
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

describe("material content runtime client", () => {
  it.live("posts once and verifies the nested signed runtime", () =>
    Effect.gen(function* () {
      const found = materialResponse();
      fetchMock.mockResolvedValue(createResponse(found, 200));

      expect(
        yield* readMaterialContent(
          target,
          input,
          found.runtime.rendererManifest
        )
      ).toMatchObject({
        model: { activeReleaseId: TEST_RELEASE_ID },
        runtime: { kind: "found" },
      });
      expect(fetchMock).toHaveBeenCalledOnce();
      const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
      expect(requestUrl).toBe(endpoint);
      expect(JSON.parse(String(requestInit?.body))).toEqual({
        delivery: "public",
        ...input,
      });
      expect(verifyContentRuntimeExchange).toHaveBeenCalledOnce();
    })
  );

  it.live("preserves exact absence and sanitized runtime failure", () =>
    Effect.gen(function* () {
      fetchMock
        .mockResolvedValueOnce(createResponse({ kind: "missing" }, 404))
        .mockResolvedValueOnce(
          createResponse(
            { code: "CONTENT_RUNTIME_INTERNAL", kind: "failure" },
            500
          )
        );

      expect(
        yield* readMaterialContent(target, input, {}).pipe(Effect.flip)
      ).toEqual(
        new ContentRuntimeMissingError({
          request: { delivery: "public", ...input },
        })
      );
      expect(
        yield* readMaterialContent(target, input, {}).pipe(Effect.flip)
      ).toEqual(
        new ContentRuntimeFailureError({
          code: "CONTENT_RUNTIME_INTERNAL",
          status: 500,
        })
      );
      expect(verifyMock).not.toHaveBeenCalled();
    })
  );

  it.live(
    "rejects malformed requests, marked responses, and unmarked responses",
    () =>
      Effect.gen(function* () {
        expect(
          yield* readMaterialContent(
            target,
            { ...input, publicPath: "" },
            {}
          ).pipe(Effect.flip)
        ).toEqual(new ContentTransportError({ reason: "request" }));
        expect(fetchMock).not.toHaveBeenCalled();

        fetchMock
          .mockResolvedValueOnce(createResponse({ unexpected: true }, 200))
          .mockResolvedValueOnce(
            createResponse({ unexpected: true }, 200, false)
          );

        expect(
          yield* readMaterialContent(target, input, {}).pipe(Effect.flip)
        ).toEqual(new ContentTransportError({ reason: "response-contract" }));
        expect(
          yield* readMaterialContent(target, input, {}).pipe(Effect.flip)
        ).toEqual(new ContentTransportError({ reason: "response-unmarked" }));
      })
  );

  it.live("preserves nested signature verification failures", () =>
    Effect.gen(function* () {
      const cause = new Error("signature mismatch");
      const found = materialResponse();
      fetchMock.mockResolvedValue(createResponse(found, 200));
      verifyMock.mockReturnValue(Effect.fail(cause));

      expect(
        yield* readMaterialContent(
          target,
          input,
          found.runtime.rendererManifest
        ).pipe(Effect.flip)
      ).toEqual(new ContentRuntimeVerificationError({ cause }));
    })
  );

  it.live("rejects a nested runtime above its singular wire ceiling", () =>
    Effect.gen(function* () {
      const found = materialResponse();
      found.runtime.artifact.payload.compiledCode = "x".repeat(
        MAX_PUBLIC_RUNTIME_RESPONSE_BYTES
      );
      fetchMock.mockResolvedValue(createResponse(found, 200));

      expect(
        yield* readMaterialContent(
          target,
          input,
          found.runtime.rendererManifest
        ).pipe(Effect.flip)
      ).toEqual(new ContentTransportError({ reason: "response-contract" }));
      expect(verifyMock).not.toHaveBeenCalled();
    })
  );
});
