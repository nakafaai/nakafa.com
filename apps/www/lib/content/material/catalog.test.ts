// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  canonicalizeMaterialProjection,
  type MaterialLessonProjection,
} from "@nakafa/aksara-contracts/projection/material";
import { PROJECTION_PAGE_LIMIT } from "@repo/backend/convex/contentRelease/paging";
import { Effect } from "effect";
import {
  getPublishedMaterialRoutes,
  readPublishedMaterialPage,
  readPublishedMaterialRoutes,
} from "@/lib/content/material/catalog";
import { makeMaterialRuntimeSource } from "@/test/content/material";
import { createTestSnapshotContext } from "@/test/content/snapshot";
import { previewIdProjection, previewProjection } from "@/test/content-preview";
import {
  createTestRuntimeQuery,
  createTestSnapshotQuery,
} from "@/test/runtime-query";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
const runtimeReadMock = vi.hoisted(() => vi.fn());
const cacheMock = vi.hoisted(() => vi.fn());
const manifestHash = `sha256:${"a".repeat(64)}`;
const releaseId = "release-material";
const sourceRevision = "a".repeat(40);

vi.mock("@/lib/content/cache", () => ({
  applyContentRuntimeCache: cacheMock,
}));
vi.mock("@/lib/content/runtime/query", () => ({
  readRuntimeQuery: runtimeReadMock,
}));

/** Builds one bounded material page returned by Convex. */
function materialPage({
  done = true,
  managed = true,
  revision = sourceRevision,
  routes = [previewProjection],
  stale = false,
}: {
  readonly done?: boolean;
  readonly managed?: boolean;
  readonly revision?: null | string;
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
    sourceRevision: managed ? revision : null,
    stale,
  };
}

beforeEach(() => {
  runtimeQueryMock.mockReset();
  runtimeReadMock.mockImplementation(createTestRuntimeQuery(runtimeQueryMock));
  cacheMock.mockReset();
});

describe("published material catalog", () => {
  it.effect("reads the localized catalog from authenticated serving rows", () =>
    Effect.gen(function* () {
      const fixture = yield* makeMaterialRuntimeSource();
      const context = yield* createTestSnapshotContext(fixture.source);
      runtimeReadMock.mockImplementation(createTestSnapshotQuery(context));

      const catalog = yield* readPublishedMaterialRoutes("en");
      expect(catalog).toMatchObject({
        activeManifestHash: fixture.state.activeManifestHash,
        activeReleaseId: fixture.state.activeReleaseId,
        routes: fixture.projections.filter((row) => row.appLocale === "en"),
      });
      expect(runtimeQueryMock).not.toHaveBeenCalled();
    })
  );

  it.effect("decodes one bounded release page", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValueOnce(materialPage({ done: false }));

      expect(
        yield* readPublishedMaterialPage({
          cursor: null,
          expectedManifestHash: null,
          expectedReleaseId: null,
          locale: "en",
        })
      ).toMatchObject({
        activeManifestHash: manifestHash,
        activeReleaseId: releaseId,
        done: false,
        managed: true,
        nextCursor: "next",
        routes: [previewProjection],
        sourceRevision,
        stale: false,
      });
      expect(runtimeQueryMock).toHaveBeenCalledWith(expect.anything(), {
        appLocale: "en",
        expectedManifestHash: null,
        expectedReleaseId: null,
        paginationOpts: { cursor: null, numItems: PROJECTION_PAGE_LIMIT },
      });
    })
  );

  it("reads all pages through one stable release cursor", async () => {
    runtimeQueryMock
      .mockResolvedValueOnce(materialPage({ done: false }))
      .mockResolvedValueOnce(materialPage());

    await expect(getPublishedMaterialRoutes("en")).resolves.toMatchObject({
      activeManifestHash: manifestHash,
      activeReleaseId: releaseId,
      appLocale: "en",
      routes: [previewProjection, previewProjection],
      sourceRevision,
    });
    expect(runtimeQueryMock).toHaveBeenNthCalledWith(2, expect.anything(), {
      appLocale: "en",
      expectedManifestHash: manifestHash,
      expectedReleaseId: releaseId,
      paginationOpts: { cursor: "next", numItems: PROJECTION_PAGE_LIMIT },
    });
    expect(cacheMock).toHaveBeenCalledOnce();
  });

  it.effect("rejects unmanaged and stale ownership states", () =>
    Effect.gen(function* () {
      runtimeQueryMock
        .mockResolvedValueOnce(materialPage({ managed: false, routes: [] }))
        .mockResolvedValueOnce(materialPage({ routes: [], stale: true }));

      expect(
        yield* readPublishedMaterialRoutes("en").pipe(Effect.flip)
      ).toMatchObject({ _tag: "PublishedProjectionError" });
      expect(
        yield* readPublishedMaterialRoutes("en").pipe(Effect.flip)
      ).toMatchObject({ _tag: "PublishedProjectionError" });
    })
  );

  it.effect("rejects missing, malformed, and changing release identities", () =>
    Effect.gen(function* () {
      runtimeQueryMock
        .mockResolvedValueOnce({
          ...materialPage(),
          activeReleaseId: null,
        })
        .mockResolvedValueOnce({
          ...materialPage(),
          activeManifestHash: "invalid",
        })
        .mockResolvedValueOnce(materialPage({ done: false }))
        .mockResolvedValueOnce({
          ...materialPage(),
          activeReleaseId: "release-other",
        });

      for (let attempt = 0; attempt < 3; attempt += 1) {
        expect(
          yield* readPublishedMaterialRoutes("en").pipe(Effect.flip)
        ).toMatchObject({ _tag: "PublishedProjectionError" });
      }
    })
  );

  it.effect("rejects malformed and changing source revisions", () =>
    Effect.gen(function* () {
      runtimeQueryMock
        .mockResolvedValueOnce(materialPage({ revision: "main" }))
        .mockResolvedValueOnce(materialPage({ done: false }))
        .mockResolvedValueOnce(materialPage({ revision: "b".repeat(40) }));

      for (let attempt = 0; attempt < 2; attempt += 1) {
        expect(
          yield* readPublishedMaterialRoutes("en").pipe(Effect.flip)
        ).toMatchObject({ _tag: "PublishedProjectionError" });
      }
    })
  );

  it.effect.each([
    ["foreign locale", materialPage({ routes: [previewIdProjection] })],
    [
      "missing continuation identity",
      {
        ...materialPage({ done: false }),
        activeManifestHash: null,
      },
    ],
  ])("rejects %s", ([_label, result]) =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValueOnce(result);

      expect(
        yield* readPublishedMaterialPage({
          cursor: null,
          expectedManifestHash: null,
          expectedReleaseId: null,
          locale: "en",
        }).pipe(Effect.flip)
      ).toMatchObject({ _tag: "PublishedProjectionError" });
    })
  );
});
