// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { PROJECTION_PAGE_LIMIT } from "@repo/backend/convex/contentRelease/paging";
import { Effect } from "effect";
import { vi } from "vitest";
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
const runtimeQueryMock = vi.hoisted(() => vi.fn());
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
  const { createTestRuntimeQuery } = await import("@/test/runtime-query");
  return {
    readRuntimeQuery: createTestRuntimeQuery(runtimeQueryMock),
  };
});

describe("published program catalog", () => {
  beforeEach(() => {
    cacheMock.mockReset();
    runtimeQueryMock.mockReset();
  });

  it.effect("decodes real program roots and applies the runtime cache", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValueOnce(catalogResponse());

      const catalog = yield* Effect.tryPromise(() =>
        getPublishedProgramCatalog("en")
      );

      expect(catalog).toMatchObject({
        entries: [
          {
            program: { key: "merdeka" },
            route: { publicPath: "curriculum/merdeka" },
          },
        ],
        sourceRevision: revision,
      });
      expect(cacheMock).toHaveBeenCalledOnce();
    })
  );

  it.effect("rejects an unmanaged catalog", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValueOnce(
        catalogResponse({
          managed: false,
          programJson: [],
          routeJson: [],
          sourceRevision: null,
        })
      );

      const failure = yield* readPublishedProgramCatalog("id").pipe(
        Effect.flip
      );
      expect(failure).toMatchObject({ _tag: "PublishedProjectionError" });
    })
  );

  it.effect.each([
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
  ] as const)("rejects a catalog with %s", ([_name, response]) =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValueOnce(response);

      const failure = yield* readPublishedProgramCatalog("en").pipe(
        Effect.flip
      );
      expect(failure).toMatchObject({ _tag: "PublishedProjectionError" });
    })
  );

  it.effect("reads every route page under one immutable release identity", () =>
    Effect.gen(function* () {
      runtimeQueryMock
        .mockResolvedValueOnce(pageResponse({ isDone: false }))
        .mockResolvedValueOnce(
          pageResponse({
            page: [testCurriculumRowJson(testProgramClass)],
          })
        );

      const catalog = yield* Effect.tryPromise(() =>
        getPublishedProgramRoutes("en")
      );

      expect(catalog).toMatchObject({
        routes: [
          { publicPath: "curriculum/merdeka" },
          { publicPath: "curriculum/merdeka/class-11" },
        ],
        sourceRevision: revision,
      });
      expect(runtimeQueryMock).toHaveBeenNthCalledWith(2, expect.anything(), {
        appLocale: "en",
        expectedManifestHash: `sha256:${"b".repeat(64)}`,
        expectedReleaseId: "program-release",
        paginationOpts: { cursor: "next", numItems: PROJECTION_PAGE_LIMIT },
      });
      expect(cacheMock).toHaveBeenCalledOnce();
    })
  );

  it.effect("preserves both terminal page cursor states", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValueOnce(pageResponse({ isDone: false }));

      const page = yield* readPublishedProgramPage({
        cursor: null,
        expectedManifestHash: null,
        expectedReleaseId: null,
        locale: "en",
      });
      expect(page).toMatchObject({
        done: false,
        nextCursor: "next",
      });
    })
  );

  it.effect("rejects routes before Aksara owns the program family", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValueOnce(
        pageResponse({ managed: false, page: [] })
      );

      const failure = yield* readPublishedProgramRoutes("id").pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "PublishedProjectionError" });
    })
  );

  it.effect.each([
    ["stale page", pageResponse({ stale: true })],
    [
      "missing continuation identity",
      { ...pageResponse({ isDone: false }), activeReleaseId: null },
    ],
  ] as const)("rejects a %s", ([_name, response]) =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValueOnce(response);

      const failure = yield* readPublishedProgramRoutes("en").pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "PublishedProjectionError" });
    })
  );

  it.effect(
    "preserves runtime query failures in the Effect error channel",
    () =>
      Effect.gen(function* () {
        runtimeQueryMock.mockRejectedValueOnce(
          new Error("program unavailable")
        );

        const failure = yield* readPublishedProgramCatalog("en").pipe(
          Effect.flip
        );
        expect(failure).toMatchObject({
          _tag: "TestRuntimeQueryError",
          message: "Error: program unavailable",
        });
      })
  );
});
