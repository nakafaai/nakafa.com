// @vitest-environment node

import {
  ContentKeySchema,
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { ContentReleaseManifestSchema } from "@nakafa/aksara-contracts/release";
import {
  inheritContentSnapshots,
  replaceContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import type { ProtectedContentRuntimeRequest } from "@nakafa/aksara-contracts/runtime/protected/spec";
import { verifyProtectedContentRuntimeExchange } from "@nakafa/aksara-contracts/runtime/protected/verify";
import { ContentRuntimeMissingError } from "@repo/backend/client/content/errors";
import { readProtectedContent } from "@repo/backend/client/content/protected";
import {
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedArtifact,
  testSignedRelease,
} from "@repo/backend/test/content-proof";
import { testPublicationScope } from "@repo/backend/test/content-release";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const endpoint =
  "https://example.convex.site/internal/content/runtime/protected";
const target = {
  siteUrl: "https://example.convex.site",
  token: "runtime-test-token",
};
const releaseId = ReleaseIdSchema.make("release-protected-client");
const snapshotId = Sha256HashSchema.make(`sha256:${"a".repeat(64)}`);
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
const request: ProtectedContentRuntimeRequest = {
  locale: "en",
  selectors: [
    {
      artifactHash: artifact.artifactHash,
      contentKey,
      delivery: "authenticated",
    },
  ],
  snapshotReleaseId: release.manifest.releaseId,
  snapshotId,
};
const found = {
  items: [
    {
      artifact,
      delivery: "authenticated",
      sourcePath: `packages/corpus/${contentKey}/en.mdx`,
    },
  ],
  kind: "found",
  release,
  rendererManifest: TEST_PROOF_RENDERER,
  snapshotManifestHash: release.manifestHash,
  snapshotReleaseId: release.manifest.releaseId,
  snapshotId,
};
const fetchMock = vi.hoisted(() => vi.fn<typeof fetch>());
const verifyMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@nakafa/aksara-contracts/runtime/protected/verify", () => ({
  verifyProtectedContentRuntimeExchange: verifyMock,
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
  it("posts and verifies one retained-snapshot batch", async () => {
    fetchMock.mockResolvedValue(createResponse(found, 200));

    await expect(
      Effect.runPromise(
        readProtectedContent(target, request, TEST_PROOF_RENDERER)
      )
    ).resolves.toMatchObject({ items: [{ delivery: "authenticated" }] });
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls.at(0);
    if (!call || typeof call[1]?.body !== "string") {
      throw new Error("Expected one JSON protected runtime request.");
    }
    expect(call[0]).toBe(endpoint);
    expect(JSON.parse(call[1].body)).toEqual(request);
    expect(verifyProtectedContentRuntimeExchange).toHaveBeenCalledOnce();
  });

  it("returns a typed absence bound to the complete batch request", async () => {
    fetchMock.mockResolvedValue(createResponse({ kind: "missing" }, 404));

    await expect(
      Effect.runPromise(
        readProtectedContent(target, request, TEST_PROOF_RENDERER).pipe(
          Effect.flip
        )
      )
    ).resolves.toEqual(new ContentRuntimeMissingError({ request }));
  });
});
