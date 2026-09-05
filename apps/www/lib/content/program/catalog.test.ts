// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { PROJECTION_PAGE_LIMIT } from "@repo/backend/convex/contentRelease/paging";
import { makeProgramRuntimeSource } from "@repo/backend/test/program/runtime";
import { Effect } from "effect";
import {
  getPublishedProgramCatalog,
  getPublishedProgramRoutes,
  readPublishedProgramCatalog,
  readPublishedProgramPage,
  readPublishedProgramRoutes,
} from "@/lib/content/program/catalog";
import { createTestSnapshotContext } from "@/test/content/snapshot";
import {
  testCurriculumRowJson,
  testProgramClass,
  testProgramRoot,
  testProgramRowJson,
} from "@/test/content-program";
import {
  createTestRuntimeQuery,
  createTestSnapshotQuery,
} from "@/test/runtime-query";

const cacheMock = vi.hoisted(() => vi.fn());
const runtimeQueryMock = vi.hoisted(() => vi.fn());
const readQueryMock = vi.hoisted(() => vi.fn());
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
vi.mock("@/lib/content/runtime/query", () => ({
  readRuntimeQuery: readQueryMock,
}));

describe("published program catalog", () => {
  beforeEach(() => {
    cacheMock.mockReset();
    runtimeQueryMock.mockReset();
    readQueryMock
      .mockReset()
      .mockImplementation(createTestRuntimeQuery(runtimeQueryMock));
  });

  it.effect(
    "reads curriculum roots and release-bound pages from the signed snapshot",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeProgramRuntimeSource();
        const context = yield* createTestSnapshotContext(fixture.source);
        readQueryMock.mockImplementation(createTestSnapshotQuery(context));

        const catalog = yield* readPublishedProgramCatalog("en");
        expect(
          catalog.entries.map(({ translation }) => translation.title)
        ).toEqual(["Technical Program 1", "Technical Program 2"]);
        const page = yield* readPublishedProgramPage({
          cursor: null,
          expectedManifestHash: null,
          expectedReleaseId: null,
          locale: "en",
        });
        expect(page).toMatchObject({
          activeManifestHash: fixture.state.activeManifestHash,
          activeReleaseId: fixture.state.activeReleaseId,
          done: true,
          managed: true,
          stale: false,
        });
        expect(page.routes.map(({ publicPath }) => publicPath)).toEqual([
          "curriculum/technical-program-1",
          "curriculum/technical-program-2",
        ]);
      })
  );

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
