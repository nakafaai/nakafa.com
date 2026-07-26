// @vitest-environment node

import { PROJECTION_PAGE_LIMIT } from "@repo/backend/convex/contentRelease/paging";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPublishedProgramCatalog,
  getPublishedProgramRoutes,
  readPublishedProgramCatalog,
  readPublishedProgramPage,
  readPublishedProgramRoutes,
} from "@/lib/content/program/catalog";
import {
  testCurriculumRowJson,
  testProgramClass,
  testProgramRoot,
  testProgramRowJson,
} from "@/test/content-program";

const cacheMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());
const revision = "a".repeat(40);

/** Builds one successful bounded program catalog response. */
function catalogResponse(overrides?: {
  readonly managed?: boolean;
  readonly programJson?: readonly string[];
  readonly routeJson?: readonly string[];
  readonly sourceRevision?: null | string;
}) {
  return {
    activeManifestHash: `sha256:${"b".repeat(64)}`,
    activeReleaseId: "program-release",
    managed: overrides?.managed ?? true,
    programJson: overrides?.programJson ?? [testProgramRowJson()],
    routeJson: overrides?.routeJson ?? [testCurriculumRowJson(testProgramRoot)],
    snapshotId: `sha256:${"c".repeat(64)}`,
    sourceRevision:
      overrides?.sourceRevision === undefined
        ? revision
        : overrides.sourceRevision,
  };
}

/** Builds one release-bound curriculum route page response. */
function pageResponse(overrides?: {
  readonly isDone?: boolean;
  readonly managed?: boolean;
  readonly page?: readonly string[];
  readonly stale?: boolean;
}) {
  return {
    activeManifestHash: `sha256:${"b".repeat(64)}`,
    activeReleaseId: "program-release",
    managed: overrides?.managed ?? true,
    result: {
      continueCursor: "next",
      isDone: overrides?.isDone ?? true,
      page: overrides?.page ?? [testCurriculumRowJson(testProgramRoot)],
    },
    snapshotId: `sha256:${"c".repeat(64)}`,
    sourceRevision: revision,
    stale: overrides?.stale ?? false,
  };
}

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

describe("published program catalog", () => {
  beforeEach(() => {
    cacheMock.mockReset();
    fetchMock.mockReset();
  });

  it("decodes real program roots and applies the runtime cache", async () => {
    fetchMock.mockResolvedValueOnce(catalogResponse());

    const catalog = await getPublishedProgramCatalog("en");

    expect(catalog).toMatchObject({
      entries: [
        {
          program: { key: "merdeka" },
          route: { publicPath: "curriculum/merdeka" },
        },
      ],
      managed: true,
      sourceRevision: revision,
    });
    expect(cacheMock).toHaveBeenCalledOnce();
  });

  it("preserves an unmanaged catalog without decoding source rows", async () => {
    fetchMock.mockResolvedValueOnce(
      catalogResponse({
        managed: false,
        programJson: [],
        routeJson: [],
        sourceRevision: null,
      })
    );

    await expect(
      Effect.runPromise(readPublishedProgramCatalog("id"))
    ).resolves.toEqual({
      entries: [],
      managed: false,
      sourceRevision: null,
    });
  });

  it.each([
    [
      "non-root route",
      catalogResponse({
        routeJson: [testCurriculumRowJson(testProgramClass)],
      }),
    ],
    [
      "missing program",
      catalogResponse({
        programJson: [],
      }),
    ],
    ["invalid source revision", catalogResponse({ sourceRevision: "main" })],
  ])("rejects a catalog with %s", async (_name, response) => {
    fetchMock.mockResolvedValueOnce(response);

    await expect(
      Effect.runPromise(readPublishedProgramCatalog("en").pipe(Effect.flip))
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });

  it("reads every route page under one immutable release identity", async () => {
    fetchMock
      .mockResolvedValueOnce(pageResponse({ isDone: false }))
      .mockResolvedValueOnce(
        pageResponse({
          page: [testCurriculumRowJson(testProgramClass)],
        })
      );

    const catalog = await getPublishedProgramRoutes("en");

    expect(catalog).toMatchObject({
      managed: true,
      routes: [
        { publicPath: "curriculum/merdeka" },
        { publicPath: "curriculum/merdeka/class-11" },
      ],
      sourceRevision: revision,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.anything(), {
      expectedManifestHash: `sha256:${"b".repeat(64)}`,
      expectedReleaseId: "program-release",
      locale: "en",
      paginationOpts: { cursor: "next", numItems: PROJECTION_PAGE_LIMIT },
    });
    expect(cacheMock).toHaveBeenCalledOnce();
  });

  it("preserves both terminal page cursor states", async () => {
    fetchMock.mockResolvedValueOnce(pageResponse({ isDone: false }));

    await expect(
      Effect.runPromise(
        readPublishedProgramPage({
          cursor: null,
          expectedManifestHash: null,
          expectedReleaseId: null,
          locale: "en",
        })
      )
    ).resolves.toMatchObject({
      done: false,
      nextCursor: "next",
    });
  });

  it("returns no routes before Aksara owns the program family", async () => {
    fetchMock.mockResolvedValueOnce(pageResponse({ managed: false, page: [] }));

    await expect(getPublishedProgramRoutes("id")).resolves.toEqual({
      managed: false,
      routes: [],
      sourceRevision: null,
    });
  });

  it.each([
    ["stale page", pageResponse({ stale: true })],
    [
      "missing continuation identity",
      { ...pageResponse({ isDone: false }), activeReleaseId: null },
    ],
  ])("rejects a %s", async (_name, response) => {
    fetchMock.mockResolvedValueOnce(response);

    await expect(
      Effect.runPromise(readPublishedProgramRoutes("en").pipe(Effect.flip))
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });

  it("preserves runtime query failures in the Effect error channel", async () => {
    fetchMock.mockRejectedValueOnce(new Error("program unavailable"));

    await expect(
      Effect.runPromise(readPublishedProgramCatalog("en"))
    ).rejects.toThrow("program unavailable");
  });
});
