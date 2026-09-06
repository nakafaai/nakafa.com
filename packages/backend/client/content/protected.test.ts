// @vitest-environment node

import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import {
  ContentKeySchema,
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { ACTIVE_APP_LOCALES } from "@nakafa/aksara-contracts/locale";
import { ContentReleaseManifestSchema } from "@nakafa/aksara-contracts/release";
import {
  inheritContentSnapshots,
  replaceContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import type { ProtectedContentRuntimeRequest } from "@nakafa/aksara-contracts/runtime/protected/spec";
import { verifyProtectedContentRuntimeExchange } from "@nakafa/aksara-contracts/runtime/protected/verify";
import { makeTryoutSnapshot } from "@nakafa/aksara-contracts/tryout/snapshot/hash";
import {
  ContentRuntimeFailureError,
  ContentRuntimeMissingError,
  ContentRuntimeVerificationError,
  ContentTransportError,
} from "@repo/backend/client/content/errors";
import { readProtectedContent } from "@repo/backend/client/content/protected";
import {
  CONTENT_RUNTIME_RESPONSE_HEADER,
  CONTENT_RUNTIME_RESPONSE_MARKER,
  PROTECTED_CONTENT_RUNTIME_PATH,
} from "@repo/backend/content/endpoint";
import {
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedArtifact,
  testSignedRelease,
  testSignedTryoutRuntimeBundle,
} from "@repo/backend/test/content/proof";
import { testPublicationScope } from "@repo/backend/test/content/release";
import { Effect } from "effect";

const endpoint = `https://example.convex.site${PROTECTED_CONTENT_RUNTIME_PATH}`;
const target = {
  siteUrl: "https://example.convex.site",
  token: "runtime-test-token",
};
const releaseId = ReleaseIdSchema.make("release-protected-client");
const digest = Sha256HashSchema.make(`sha256:${"a".repeat(64)}`);
const snapshot = makeTryoutSnapshot({
  activeAppLocales: ACTIVE_APP_LOCALES,
  catalogDigest: digest,
  counts: { country: 1, exam: 1, section: 1, set: 1, track: 1 },
  placementCount: 1,
  placementDigest: digest,
  routeCount: 1,
});
const snapshotId = snapshot.snapshotId;
const snapshots = {
  ...inheritContentSnapshots(null),
  tryout: replaceContentSnapshot({
    baseSnapshotId: null,
    resultSnapshotId: snapshotId,
    rowCount: 1,
    rowDigest: snapshotId,
  }),
};
const release = testSignedRelease(
  ContentReleaseManifestSchema.make({
    ...testEmptyManifest(releaseId),
    scope: testPublicationScope({ snapshots }),
    snapshots,
  })
);
const contentKey = ContentKeySchema.make(
  "question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1/question-1/question"
);
const artifact = testSignedArtifact("snbt-quant", { contentKey });
const bundle = testSignedTryoutRuntimeBundle({
  release,
  rendererManifest: TEST_PROOF_RENDERER,
  snapshot,
});
const request: ProtectedContentRuntimeRequest = {
  bundleHash: bundle.bundleHash,
  selectors: [
    {
      artifactHash: artifact.artifactHash,
      contentKey,
      delivery: "authenticated",
    },
  ],
  snapshotId,
};
const found = {
  bundle,
  items: [
    {
      artifact,
      delivery: "authenticated",
      sourcePath: `packages/corpus/${contentKey}/en.mdx`,
    },
  ],
  kind: "found",
  rendererManifest: TEST_PROOF_RENDERER,
};
const fetchMock = vi.hoisted(() => vi.fn<typeof fetch>());
const verifyMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@repo/backend/content/trust", async () => {
  const { TEST_KEY_RESOLVER } = await import(
    "@repo/backend/test/content/proof"
  );
  return { contentKeyResolver: TEST_KEY_RESOLVER };
});
vi.mock("@nakafa/aksara-contracts/runtime/protected/verify", () => ({
  verifyProtectedContentRuntimeExchange: verifyMock,
}));

/** Creates one response with the immutable network URL populated. */
function createResponse(body: unknown, status: number, marked = true) {
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
  Object.defineProperty(response, "url", { value: endpoint });
  return response;
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

describe("protected content runtime client", () => {
  it.effect("rejects invalid requests before transport", () =>
    Effect.gen(function* () {
      expect(
        yield* readProtectedContent(target, {}, TEST_PROOF_RENDERER).pipe(
          Effect.flip
        )
      ).toEqual(new ContentTransportError({ reason: "request" }));
      expect(fetchMock).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "preserves runtime failures and cryptographic verification failures",
    () =>
      Effect.gen(function* () {
        const failure = { kind: "failure", code: "CONTENT_RUNTIME_INTERNAL" };
        fetchMock.mockResolvedValueOnce(createResponse(failure, 500));
        expect(
          yield* readProtectedContent(
            target,
            request,
            TEST_PROOF_RENDERER
          ).pipe(Effect.flip)
        ).toEqual(
          new ContentRuntimeFailureError({
            code: "CONTENT_RUNTIME_INTERNAL",
            status: 500,
          })
        );
        const cause = new ContentTransportError({
          reason: "response-contract",
        });
        verifyMock.mockImplementationOnce(() => Effect.fail(cause));
        fetchMock.mockResolvedValueOnce(createResponse(found, 200));
        expect(
          yield* readProtectedContent(
            target,
            request,
            TEST_PROOF_RENDERER
          ).pipe(Effect.flip)
        ).toEqual(new ContentRuntimeVerificationError({ cause }));
      })
  );

  it.effect("posts and verifies one retained-snapshot batch", () =>
    Effect.gen(function* () {
      fetchMock.mockResolvedValue(createResponse(found, 200, false));

      expect(
        yield* readProtectedContent(target, request, TEST_PROOF_RENDERER)
      ).toMatchObject({ items: [{ delivery: "authenticated" }] });
      expect(fetchMock).toHaveBeenCalledOnce();
      const call = fetchMock.mock.calls.at(0);
      assert(
        call && typeof call[1]?.body === "string",
        "Expected one JSON protected runtime request."
      );
      expect(call[0]).toBe(endpoint);
      expect(JSON.parse(call[1].body)).toEqual(request);
      expect(verifyProtectedContentRuntimeExchange).toHaveBeenCalledOnce();
    })
  );

  it.effect("returns a typed absence bound to the complete batch request", () =>
    Effect.gen(function* () {
      fetchMock.mockResolvedValue(createResponse({ kind: "missing" }, 404));

      expect(
        yield* readProtectedContent(target, request, TEST_PROOF_RENDERER).pipe(
          Effect.flip
        )
      ).toEqual(new ContentRuntimeMissingError({ request }));
    })
  );

  it.effect(
    "classifies valid JSON outside the protected response contract",
    () =>
      Effect.gen(function* () {
        fetchMock
          .mockResolvedValueOnce(
            createResponse({ unexpected: true }, 200, false)
          )
          .mockResolvedValueOnce(createResponse({ unexpected: true }, 200));

        expect(
          yield* readProtectedContent(
            target,
            request,
            TEST_PROOF_RENDERER
          ).pipe(Effect.flip)
        ).toEqual(new ContentTransportError({ reason: "response-unmarked" }));
        expect(
          yield* readProtectedContent(
            target,
            request,
            TEST_PROOF_RENDERER
          ).pipe(Effect.flip)
        ).toEqual(new ContentTransportError({ reason: "response-contract" }));
        expect(verifyProtectedContentRuntimeExchange).not.toHaveBeenCalled();
      })
  );
});
