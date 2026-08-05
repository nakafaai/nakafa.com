// @vitest-environment node

import {
  canonicalizeMaterialProjection,
  type MaterialLessonProjection,
} from "@nakafa/aksara-contracts/projection/material";
import { PROJECTION_PAGE_LIMIT } from "@repo/backend/convex/contentRelease/paging";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPublishedMaterialRoutes,
  readPublishedMaterialPage,
  readPublishedMaterialRoutes,
} from "@/lib/content/material/catalog";
import { previewIdProjection, previewProjection } from "@/test/content-preview";

const fetchMock = vi.hoisted(() => vi.fn());
const cacheMock = vi.hoisted(() => vi.fn());
const manifestHash = `sha256:${"a".repeat(64)}`;
const releaseId = "release-material";
const sourceRevision = "a".repeat(40);

vi.mock("@/lib/content/cache", () => ({
  applyContentRuntimeCache: cacheMock,
}));
vi.mock("@/lib/content/runtime/query", async () => {
  const { readTestRuntimeQuery } = await import("@/test/runtime-query");
  return {
    fetchRuntimeQuery: fetchMock,
    readRuntimeQuery: readTestRuntimeQuery,
  };
});

/** Builds one bounded material page returned by Convex. */
function materialPage({
  done = true,
  managed = true,
  routes = [previewProjection],
  stale = false,
}: {
  readonly done?: boolean;
  readonly managed?: boolean;
  readonly routes?: readonly MaterialLessonProjection[];
  readonly stale?: boolean;
} = {}) {
  return {
    activeManifestHash: managed ? manifestHash : null,
    activeReleaseId: managed ? releaseId : null,
    managed,
    result: {
      continueCursor: done ? "" : "next",
      isDone: done,
      page: routes.map((route) => canonicalizeMaterialProjection(route)),
    },
    sourceRevision: managed ? sourceRevision : null,
    stale,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  cacheMock.mockReset();
});

describe("published material catalog", () => {
  it("decodes one bounded release page", async () => {
    fetchMock.mockResolvedValueOnce(materialPage({ done: false }));

    await expect(
      Effect.runPromise(
        readPublishedMaterialPage({
          cursor: null,
          expectedManifestHash: null,
          expectedReleaseId: null,
          locale: "en",
        })
      )
    ).resolves.toMatchObject({
      activeManifestHash: manifestHash,
      activeReleaseId: releaseId,
      done: false,
      managed: true,
      nextCursor: "next",
      routes: [previewProjection],
      sourceRevision,
      stale: false,
    });
    expect(fetchMock).toHaveBeenCalledWith(expect.anything(), {
      expectedManifestHash: null,
      expectedReleaseId: null,
      locale: "en",
      paginationOpts: { cursor: null, numItems: PROJECTION_PAGE_LIMIT },
    });
  });

  it("reads all pages through one stable release cursor", async () => {
    fetchMock
      .mockResolvedValueOnce(materialPage({ done: false }))
      .mockResolvedValueOnce(materialPage());

    await expect(getPublishedMaterialRoutes("en")).resolves.toMatchObject({
      routes: [previewProjection, previewProjection],
      sourceRevision,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.anything(), {
      expectedManifestHash: manifestHash,
      expectedReleaseId: releaseId,
      locale: "en",
      paginationOpts: { cursor: "next", numItems: PROJECTION_PAGE_LIMIT },
    });
    expect(cacheMock).toHaveBeenCalledOnce();
  });

  it("rejects unmanaged and stale ownership states", async () => {
    fetchMock
      .mockResolvedValueOnce(materialPage({ managed: false, routes: [] }))
      .mockResolvedValueOnce(materialPage({ routes: [], stale: true }));

    await expect(
      Effect.runPromise(readPublishedMaterialRoutes("en").pipe(Effect.flip))
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
    await expect(
      Effect.runPromise(readPublishedMaterialRoutes("en").pipe(Effect.flip))
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });

  it.each([
    ["foreign locale", materialPage({ routes: [previewIdProjection] })],
    [
      "missing continuation identity",
      {
        ...materialPage({ done: false }),
        activeManifestHash: null,
      },
    ],
  ])("rejects %s", async (_label, result) => {
    fetchMock.mockResolvedValueOnce(result);

    await expect(
      Effect.runPromise(
        readPublishedMaterialPage({
          cursor: null,
          expectedManifestHash: null,
          expectedReleaseId: null,
          locale: "en",
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });
});
