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
import {
  readPublicContent,
  readPublicContentEvidence,
  readPublicContentEvidenceBatch,
  readSnapshotPublicContent,
} from "@repo/backend/client/content/public";
import {
  CONTENT_RUNTIME_RESPONSE_HEADER,
  CONTENT_RUNTIME_RESPONSE_MARKER,
  PUBLIC_CONTENT_RUNTIME_BATCH_PATH,
  PUBLIC_CONTENT_RUNTIME_PATH,
} from "@repo/backend/content/endpoint";
import { snapshotPublicationLayer } from "@repo/backend/content/publication/snapshot";
import { projectActiveRuntime } from "@repo/backend/content/snapshot/projection";
import { testArtifactJson } from "@repo/backend/test/content/artifact";
import { testProjectionJson } from "@repo/backend/test/content/material";
import { TEST_PROOF_RENDERER } from "@repo/backend/test/content/proof";
import {
  TEST_DIGEST,
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
  testReleaseJson,
  testRendererJson,
} from "@repo/backend/test/content/release";
import { makePageRuntimeSource } from "@repo/backend/test/content/snapshot";
import { Effect } from "effect";

const endpoint = `https://example.convex.site${PUBLIC_CONTENT_RUNTIME_PATH}`;
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
  it.effect(
    "reads the exact signed snapshot body and preserves explicit absence without network access",
    () =>
      Effect.gen(function* () {
        const fixture = makePageRuntimeSource();
        const tables = yield* projectActiveRuntime(fixture.source);
        yield* Effect.gen(function* () {
          const selected = {
            appLocale: fixture.projection.appLocale,
            publicPath: fixture.projection.publicPath,
          };
          const result = yield* readSnapshotPublicContent(
            selected,
            TEST_PROOF_RENDERER
          );
          expect(result.artifact).toEqual(fixture.artifact);
          expect(result.sourcePath).toEqual(fixture.projection.sourcePath);
          expect(result.activeReleaseId).toEqual(fixture.state.activeReleaseId);
          expect(
            yield* readSnapshotPublicContent(
              { ...selected, publicPath: "missing/page" },
              TEST_PROOF_RENDERER
            ).pipe(Effect.flip)
          ).toMatchObject({ _tag: "ContentRuntimeMissingError" });
          expect(
            yield* readSnapshotPublicContent(
              { ...selected, publicPath: "" },
              TEST_PROOF_RENDERER
            ).pipe(Effect.flip)
          ).toEqual(new ContentTransportError({ reason: "request" }));
        }).pipe(Effect.provide(snapshotPublicationLayer(tables)));
        expect(fetchMock).not.toHaveBeenCalled();
      })
  );

  it.effect("rejects invalid single and batch routes before transport", () =>
    Effect.gen(function* () {
      const invalid = { ...input, publicPath: "" };
      expect(
        yield* readPublicContentEvidence(target, invalid).pipe(Effect.flip)
      ).toEqual(new ContentTransportError({ reason: "request" }));
      expect(
        yield* readPublicContentEvidenceBatch(target, [invalid]).pipe(
          Effect.flip
        )
      ).toEqual(new ContentTransportError({ reason: "request" }));
      expect(fetchMock).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "rejects malformed batch errors and single-item absence at the batch endpoint",
    () =>
      Effect.gen(function* () {
        fetchMock.mockResolvedValueOnce(
          createResponse({ unexpected: true }, 500, true, batchEndpoint)
        );
        fetchMock.mockResolvedValueOnce(
          createResponse({ kind: "missing" }, 404, true, batchEndpoint)
        );
        for (let index = 0; index < 2; index += 1) {
          expect(
            yield* readPublicContentEvidenceBatch(target, [input]).pipe(
              Effect.flip
            )
          ).toEqual(new ContentTransportError({ reason: "response-contract" }));
        }
        expect(verifyMock).not.toHaveBeenCalled();
      })
  );
  it.live("posts, verifies, and returns one active public artifact", () =>
    Effect.gen(function* () {
      const found = foundResponse();
      fetchMock.mockResolvedValue(createResponse(found, 200, false));

      expect(
        yield* readPublicContent(target, input, found.rendererManifest)
      ).toMatchObject({ kind: "found" });
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
    })
  );

  it.live("posts one ordered eight-item batch without singular fallback", () =>
    Effect.gen(function* () {
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

      expect(
        yield* readPublicContentEvidenceBatch(target, inputs)
      ).toHaveLength(8);
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
    })
  );

  it.live("rejects more than eight requests before making a network call", () =>
    Effect.gen(function* () {
      const inputs = Array.from({ length: 9 }, (_, index) => ({
        appLocale: input.appLocale,
        publicPath: `test/head-${index}`,
      }));

      expect(
        yield* readPublicContentEvidenceBatch(target, inputs).pipe(Effect.flip)
      ).toEqual(new ContentTransportError({ reason: "request" }));
      expect(fetchMock).not.toHaveBeenCalled();
      expect(verifyMock).not.toHaveBeenCalled();
    })
  );

  it.live("preserves exact item absence and batch-level runtime failure", () =>
    Effect.gen(function* () {
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

      expect(
        yield* readPublicContentEvidenceBatch(target, [input]).pipe(Effect.flip)
      ).toEqual(
        new ContentRuntimeMissingError({
          request: { delivery: "public", ...input },
        })
      );
      expect(
        yield* readPublicContentEvidenceBatch(target, [input]).pipe(Effect.flip)
      ).toEqual(
        new ContentRuntimeFailureError({
          code: "CONTENT_RUNTIME_INTERNAL",
          status: 500,
        })
      );
    })
  );

  it.live("rejects a response with different batch cardinality", () =>
    Effect.gen(function* () {
      const inputs = [input, { ...input, publicPath: "test/second-head" }];
      fetchMock.mockResolvedValue(
        createResponse(
          { responses: [foundResponse()] },
          200,
          true,
          batchEndpoint
        )
      );

      expect(
        yield* readPublicContentEvidenceBatch(target, inputs).pipe(Effect.flip)
      ).toEqual(new ContentTransportError({ reason: "response-contract" }));
      expect(verifyMock).not.toHaveBeenCalled();
    })
  );

  it.live("rejects one batch item above the Aksara singular byte ceiling", () =>
    Effect.gen(function* () {
      const oversized = foundResponse(
        "x".repeat(MAX_PUBLIC_RUNTIME_RESPONSE_BYTES)
      );
      fetchMock.mockResolvedValue(
        createResponse({ responses: [oversized] }, 200, true, batchEndpoint)
      );

      expect(
        yield* readPublicContentEvidenceBatch(target, [input]).pipe(Effect.flip)
      ).toEqual(new ContentTransportError({ reason: "response-contract" }));
      expect(verifyMock).not.toHaveBeenCalled();
    })
  );

  it.live("distinguishes exact absence from sanitized runtime failure", () =>
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
        yield* readPublicContentEvidence(target, input).pipe(Effect.flip)
      ).toEqual(
        new ContentRuntimeMissingError({
          request: { delivery: "public", ...input },
        })
      );
      expect(
        yield* readPublicContentEvidence(target, input).pipe(Effect.flip)
      ).toEqual(
        new ContentRuntimeFailureError({
          code: "CONTENT_RUNTIME_INTERNAL",
          status: 500,
        })
      );
    })
  );

  it.live("classifies valid JSON outside the public response contract", () =>
    Effect.gen(function* () {
      fetchMock
        .mockResolvedValueOnce(createResponse({ unexpected: true }, 200, false))
        .mockResolvedValueOnce(createResponse({ unexpected: true }, 200));

      expect(
        yield* readPublicContentEvidence(target, input).pipe(Effect.flip)
      ).toEqual(new ContentTransportError({ reason: "response-unmarked" }));
      expect(
        yield* readPublicContentEvidence(target, input).pipe(Effect.flip)
      ).toEqual(new ContentTransportError({ reason: "response-contract" }));
      expect(verifyContentRuntimeExchange).not.toHaveBeenCalled();
    })
  );

  it.live(
    "preserves signature failures in the typed verification boundary",
    () =>
      Effect.gen(function* () {
        const cause = new Error("signature mismatch");
        fetchMock.mockResolvedValue(createResponse(foundResponse(), 200));
        verifyMock.mockReturnValue(Effect.fail(cause));

        expect(
          yield* readPublicContent(
            target,
            input,
            foundResponse().rendererManifest
          ).pipe(Effect.flip)
        ).toEqual(new ContentRuntimeVerificationError({ cause }));
      })
  );
});
