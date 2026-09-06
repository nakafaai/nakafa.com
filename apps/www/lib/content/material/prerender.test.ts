// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { GitCommitShaSchema } from "@nakafa/aksara-contracts/ids";
import { canonicalizeMaterialProjection } from "@nakafa/aksara-contracts/projection/material";
import type { api } from "@repo/backend/convex/_generated/api";
import { createTestPublication } from "@repo/backend/test/content/publication";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";
import { readPublishedMaterialPrerenderRoute } from "@/lib/content/material/prerender";
import { makeMaterialRuntimeSource } from "@/test/content/material";
import { previewIdProjection, previewProjection } from "@/test/content-preview";
import {
  createTestNativeQuery,
  createTestRuntimeQuery,
} from "@/test/runtime-query";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
const runtimeReadMock = vi.hoisted(() => vi.fn());

vi.mock("@repo/backend/client/nakafa/query", () => ({
  readNakafaRuntimeQuery: runtimeReadMock,
}));

/** Supplies the first real lesson while retaining a continuation cursor. */
function materialPage(): FunctionReturnType<
  typeof api.contentRelease.material.publications
> {
  return {
    activeManifestHash: `sha256:${"a".repeat(64)}`,
    activeReleaseId: "release-material",
    managed: true,
    result: {
      continueCursor: "more-materials",
      isDone: false,
      page: [canonicalizeMaterialProjection(previewProjection)],
    },
    sourceRevision: GitCommitShaSchema.make("a".repeat(40)),
    stale: false,
  };
}

beforeEach(() => {
  runtimeQueryMock.mockReset();
  runtimeReadMock
    .mockReset()
    .mockImplementation(createTestRuntimeQuery(runtimeQueryMock));
});

describe("published material prerender selection", () => {
  it.effect("reads one real lesson through the authenticated snapshot", () =>
    Effect.gen(function* () {
      const fixture = yield* makeMaterialRuntimeSource();
      const context = yield* createTestPublication(fixture.source);
      runtimeReadMock.mockImplementation(createTestNativeQuery(context));

      const route = yield* readPublishedMaterialPrerenderRoute("en");
      expect(route.appLocale).toBe("en");
      expect(fixture.projections).toContainEqual(route);
      expect(runtimeReadMock).toHaveBeenCalledOnce();
      expect(runtimeQueryMock).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "requests exactly one lesson without continuing the inventory",
    () =>
      Effect.gen(function* () {
        runtimeQueryMock.mockResolvedValueOnce(materialPage());

        expect(yield* readPublishedMaterialPrerenderRoute("en")).toEqual(
          previewProjection
        );
        expect(runtimeQueryMock).toHaveBeenCalledExactlyOnceWith(
          expect.anything(),
          {
            appLocale: "en",
            expectedManifestHash: null,
            expectedReleaseId: null,
            paginationOpts: { cursor: null, numItems: 1 },
          }
        );
      })
  );

  it.effect.each([
    [
      "empty inventory",
      { ...materialPage(), result: { ...materialPage().result, page: [] } },
    ],
    ["unmanaged inventory", { ...materialPage(), managed: false }],
    ["stale generation", { ...materialPage(), stale: true }],
    ["missing release", { ...materialPage(), activeReleaseId: null }],
    ["malformed release", { ...materialPage(), activeReleaseId: "" }],
    ["missing manifest", { ...materialPage(), activeManifestHash: null }],
    [
      "malformed manifest",
      { ...materialPage(), activeManifestHash: "invalid" },
    ],
    [
      "malformed source revision",
      { ...materialPage(), sourceRevision: "main" },
    ],
    [
      "malformed projection",
      { ...materialPage(), result: { ...materialPage().result, page: ["{}"] } },
    ],
    [
      "foreign locale",
      {
        ...materialPage(),
        result: {
          ...materialPage().result,
          page: [canonicalizeMaterialProjection(previewIdProjection)],
        },
      },
    ],
  ])("rejects a seed from %s", ([_label, result]) =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValueOnce(result);

      expect(
        yield* readPublishedMaterialPrerenderRoute("en").pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PublishedProjectionError",
        appLocale: "en",
        publicPath: "materials",
      });
    })
  );
});

vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_CONVEX_URL: "https://test.convex.cloud" },
}));
