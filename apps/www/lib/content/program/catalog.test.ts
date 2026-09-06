// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { createTestPublication } from "@repo/backend/test/content/publication";
import { makeProgramRuntimeSource } from "@repo/backend/test/program/runtime";
import { Effect } from "effect";
import {
  getPublishedProgramCatalog,
  getPublishedProgramSubjects,
  readPublishedProgramCatalog,
  readPublishedProgramPrerenderRoute,
  readPublishedProgramSubjects,
} from "@/lib/content/program/catalog";
import {
  testCurriculumRowJson,
  testProgramClass,
  testProgramRoot,
  testProgramRowJson,
  testProgramSubject,
} from "@/test/content-program";
import {
  createTestNativeQuery,
  createTestRuntimeQuery,
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

vi.mock("@/lib/content/cache", () => ({
  applyContentCache: cacheMock,
}));
vi.mock("@repo/backend/client/nakafa/query", () => ({
  readNakafaRuntimeQuery: readQueryMock,
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
    "selects one renderable root without enumerating descendant routes",
    () =>
      Effect.gen(function* () {
        runtimeQueryMock.mockResolvedValueOnce(catalogResponse());

        expect(yield* readPublishedProgramPrerenderRoute("en")).toEqual(
          testProgramRoot
        );
        expect(runtimeQueryMock).toHaveBeenCalledExactlyOnceWith(
          expect.anything(),
          {
            appLocale: "en",
          }
        );
      })
  );

  it.effect.each([
    ["empty inventory", catalogResponse({ routeJson: [] })],
    [
      "hidden roots",
      catalogResponse({
        routeJson: [
          testCurriculumRowJson({ ...testProgramRoot, sitemap: false }),
        ],
      }),
    ],
    ["unmanaged inventory", catalogResponse({ managed: false })],
    [
      "non-root route",
      catalogResponse({ routeJson: [testCurriculumRowJson(testProgramClass)] }),
    ],
  ])("rejects a prerender seed from %s", ([_label, result]) =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValueOnce(result);

      expect(
        yield* readPublishedProgramPrerenderRoute("en").pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PublishedProjectionError",
        appLocale: "en",
      });
    })
  );

  it.effect(
    "reads curriculum roots through the native Convex program query",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeProgramRuntimeSource();
        const context = yield* createTestPublication(fixture.source);
        readQueryMock.mockImplementation(createTestNativeQuery(context));

        const catalog = yield* readPublishedProgramCatalog("en");
        expect(
          catalog.entries.map(({ translation }) => translation.title)
        ).toEqual(["Technical Program 1", "Technical Program 2"]);
        expect(yield* readPublishedProgramPrerenderRoute("en")).toEqual(
          catalog.entries[0].route
        );
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

  it.effect("reads the bounded subject query and caches the result", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValueOnce({
        managed: true,
        routeJson: [testCurriculumRowJson(testProgramSubject)],
      });
      expect(
        yield* Effect.promise(() => getPublishedProgramSubjects("en"))
      ).toEqual([testProgramSubject]);
      expect(runtimeQueryMock).toHaveBeenCalledExactlyOnceWith(
        expect.anything(),
        { appLocale: "en" }
      );
      expect(cacheMock).toHaveBeenCalledOnce();
    })
  );

  it.effect("rejects subject reads before Aksara owns the program family", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValueOnce({ managed: false, routeJson: [] });
      expect(
        yield* readPublishedProgramSubjects("en").pipe(Effect.flip)
      ).toMatchObject({ _tag: "PublishedProjectionError" });
    })
  );

  it.effect.each([
    [
      "too many subjects",
      Array.from({ length: 5 }, () =>
        testCurriculumRowJson(testProgramSubject)
      ),
    ],
    [
      "another locale",
      [
        testCurriculumRowJson({
          ...testProgramSubject,
          appLocale: AppLocaleSchema.make("id"),
        }),
      ],
    ],
    ["a program root", [testCurriculumRowJson(testProgramRoot)]],
    [
      "a hidden subject",
      [testCurriculumRowJson({ ...testProgramSubject, sitemap: false })],
    ],
    ["malformed signed rows", ["{}"]],
  ])("rejects featured subjects containing %s", ([_name, routeJson]) =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValueOnce({ managed: true, routeJson });
      expect(
        yield* readPublishedProgramSubjects("en").pipe(Effect.flip)
      ).toMatchObject({ _tag: "PublishedProjectionError" });
    })
  );
});

vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_CONVEX_URL: "https://test.convex.cloud" },
}));
