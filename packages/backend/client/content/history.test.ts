// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { StoredProtectedRuntimeRequestSchema } from "@nakafa/aksara-contracts/history/decode";
import {
  ContentRuntimeVerificationError,
  ContentTransportError,
} from "@repo/backend/client/content/errors";
import {
  RetainedContentRuntimeMissingError,
  readRetainedProtectedContent,
} from "@repo/backend/client/content/history";
import {
  CONTENT_RUNTIME_RESPONSE_HEADER,
  CONTENT_RUNTIME_RESPONSE_MARKER,
  RETAINED_PROTECTED_CONTENT_RUNTIME_PATH,
} from "@repo/backend/content/endpoint";
import {
  RETAINED_RUNTIME_LIVE_RENDERER,
  RETAINED_RUNTIME_QUESTION,
  RETAINED_RUNTIME_RELEASE,
  retainedRuntimeFound,
} from "@repo/backend/test/runtime/retained";
import { Effect, Schema } from "effect";
import { vi } from "vitest";

const endpoint = `https://example.convex.site${RETAINED_PROTECTED_CONTENT_RUNTIME_PATH}`;
const target = {
  siteUrl: "https://example.convex.site",
  token: "retained-runtime-test-token",
};
const request = Schema.decodeSync(StoredProtectedRuntimeRequestSchema)({
  appLocale: "en",
  attemptId: "retained-client-attempt",
  selectors: [
    {
      artifactHash: RETAINED_RUNTIME_QUESTION.artifactHash,
      artifactLocale: "en",
      contentKey: RETAINED_RUNTIME_QUESTION.payload.contentKey,
      delivery: "authenticated",
    },
  ],
  snapshotId:
    RETAINED_RUNTIME_RELEASE.manifest.snapshots.tryout.resultSnapshotId,
  snapshotReleaseId: RETAINED_RUNTIME_RELEASE.manifest.releaseId,
});
const fetchMock = vi.hoisted(() => vi.fn<typeof fetch>());

vi.mock("server-only", () => ({}));
vi.mock("@repo/backend/content/trust", async () => {
  const { retainedRuntimeKeyResolver } = await import(
    "@repo/backend/test/runtime/retained"
  );
  return { contentKeyResolver: retainedRuntimeKeyResolver };
});

/** Creates one marked response with its immutable network URL populated. */
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

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("retained protected content runtime client", () => {
  it.live("posts and authenticates one fixed historical wire exchange", () =>
    Effect.gen(function* () {
      const found = retainedRuntimeFound(request.attemptId);
      fetchMock.mockResolvedValue(createResponse(found, 200, false));

      expect(
        yield* readRetainedProtectedContent(
          target,
          request,
          RETAINED_RUNTIME_LIVE_RENDERER
        )
      ).toEqual(found);
      const call = fetchMock.mock.calls.at(0);
      if (!call || typeof call[1]?.body !== "string") {
        throw new Error("Expected one retained runtime JSON request.");
      }
      expect(call[0]).toBe(endpoint);
      expect(JSON.parse(call[1].body)).toEqual(request);
    })
  );

  it.live("returns typed attempt-bound absence", () =>
    Effect.gen(function* () {
      fetchMock.mockResolvedValue(
        createResponse(
          {
            appLocale: request.appLocale,
            attemptId: request.attemptId,
            kind: "missing",
          },
          404
        )
      );

      expect(
        yield* readRetainedProtectedContent(
          target,
          request,
          RETAINED_RUNTIME_LIVE_RENDERER
        ).pipe(Effect.flip)
      ).toEqual(new RetainedContentRuntimeMissingError({ request }));
    })
  );

  it.live("rejects cross-attempt replay before exposing historical bytes", () =>
    Effect.gen(function* () {
      fetchMock.mockResolvedValue(
        createResponse(retainedRuntimeFound("another-attempt"), 200)
      );

      expect(
        yield* readRetainedProtectedContent(
          target,
          request,
          RETAINED_RUNTIME_LIVE_RENDERER
        ).pipe(Effect.flip)
      ).toBeInstanceOf(ContentRuntimeVerificationError);
    })
  );

  it.live("rejects unmarked or out-of-contract history responses", () =>
    Effect.gen(function* () {
      fetchMock
        .mockResolvedValueOnce(createResponse({ unexpected: true }, 200, false))
        .mockResolvedValueOnce(createResponse({ unexpected: true }, 200));

      expect(
        yield* readRetainedProtectedContent(
          target,
          request,
          RETAINED_RUNTIME_LIVE_RENDERER
        ).pipe(Effect.flip)
      ).toEqual(new ContentTransportError({ reason: "response-unmarked" }));
      expect(
        yield* readRetainedProtectedContent(
          target,
          request,
          RETAINED_RUNTIME_LIVE_RENDERER
        ).pipe(Effect.flip)
      ).toEqual(new ContentTransportError({ reason: "response-contract" }));
    })
  );
});
