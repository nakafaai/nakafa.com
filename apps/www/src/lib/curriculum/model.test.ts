import { Effect, Struct } from "effect";
// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { GitCommitShaSchema } from "@nakafa/aksara-contracts/ids";
import {
  type CurriculumRouteModel,
  isRenderableCurriculumView,
  readRuntimeCurriculumBreadcrumbs,
  readRuntimeCurriculumCatalog,
  readRuntimeCurriculumOptions,
  readRuntimeCurriculumToc,
  resolveRuntimeCurriculumRoute,
} from "@/lib/curriculum/model";
import { previewProjection } from "@/test/content-preview";
import {
  testProgramClass,
  testProgramContexts,
  testProgramGroups,
  testProgramRoot,
  testProgramSubject,
  testPublishedProgram,
} from "@/test/content-program";

const catalogMock = vi.hoisted(() => vi.fn());
const routeMock = vi.hoisted(() => vi.fn());
const revision = GitCommitShaSchema.make("a".repeat(40));

vi.mock("@/lib/content/program/catalog", () => ({
  readPublishedProgramCatalog: catalogMock,
}));
vi.mock("@/lib/content/cache", () => ({}));
vi.mock("@/lib/content/program/route", () => ({
  readPublishedProgramRoute: routeMock,
}));

/** Builds one complete signed route response for runtime selection. */
function publishedRoute(overrides?: {
  readonly children?: readonly (typeof testProgramClass)[];
  readonly route?: null | typeof testProgramSubject;
}) {
  return {
    activeReleaseId: "program-release",
    alternates: [testProgramSubject],
    ancestors: [testProgramRoot, testProgramClass],
    children: overrides?.children ?? [],
    contexts: testProgramContexts,
    groups: testProgramGroups,
    materials: [previewProjection],
    program: overrides?.route === null ? null : testPublishedProgram,
    route:
      overrides?.route === undefined ? testProgramSubject : overrides.route,
    sourceRevision: revision,
  };
}

describe("signed curriculum runtime", () => {
  beforeEach(() => {
    catalogMock.mockReset();
    routeMock.mockReset();
  });

  it.effect("resolves a signed route with published cards and hierarchy", () =>
    Effect.gen(function* () {
      routeMock.mockReturnValueOnce(Effect.succeed(publishedRoute()));

      const model = yield* resolveRuntimeCurriculumRoute({
        curriculum: "merdeka",
        locale: "en",
        path: ["class-11", "mathematics"],
      });

      expect(model).toMatchObject({
        ancestors: [
          { publicPath: "curriculum/merdeka" },
          { publicPath: "curriculum/merdeka/class-11" },
        ],
        materialCards: [{ items: [{ title: "Function Concept" }] }],
        route: { publicPath: testProgramSubject.publicPath },
        sourcePath: "packages/corpus/curriculum/merdeka",
        sourceRevision: revision,
      });
    })
  );

  it.effect("fails closed when a signed route is absent", () =>
    Effect.gen(function* () {
      routeMock.mockReturnValueOnce(
        Effect.succeed(publishedRoute({ route: null }))
      );

      expect(
        yield* Effect.exit(
          resolveRuntimeCurriculumRoute({ curriculum: "missing", locale: "en" })
        )
      ).toMatchObject({ _tag: "Failure" });
    })
  );

  it.effect("reads signed root cards and selector values", () =>
    Effect.gen(function* () {
      catalogMock.mockReturnValueOnce(
        Effect.succeed({
          entries: [
            {
              program: testPublishedProgram,
              route: testProgramRoot,
              translation: testPublishedProgram.translations[0],
            },
            {
              program: testPublishedProgram,
              route: { ...testProgramRoot, sitemap: false },
              translation: testPublishedProgram.translations[0],
            },
          ],
          sourceRevision: revision,
        })
      );

      const catalog = yield* readRuntimeCurriculumCatalog("en");

      expect(catalog.entries).toHaveLength(1);
      expect(readRuntimeCurriculumOptions(catalog)).toEqual([
        {
          countryCode: "ID",
          programKey: "merdeka",
          publicPath: "curriculum/merdeka",
          publicSlug: "merdeka",
          title: "Kurikulum Merdeka",
          value: "curriculum/merdeka",
        },
      ]);
    })
  );

  it.effect("omits the country for a global curriculum provider", () =>
    Effect.gen(function* () {
      catalogMock.mockReturnValueOnce(
        Effect.succeed({
          entries: [
            {
              program: {
                ...testPublishedProgram,
                provider: Struct.omit(testPublishedProgram.provider, [
                  "homeCountry",
                ]),
              },
              route: testProgramRoot,
              translation: testPublishedProgram.translations[0],
            },
          ],
          sourceRevision: revision,
        })
      );
      const catalog = yield* readRuntimeCurriculumCatalog("en");
      expect(readRuntimeCurriculumOptions(catalog)[0]).not.toHaveProperty(
        "countryCode"
      );
    })
  );

  it.effect("builds route presentation from signed ancestors", () =>
    Effect.gen(function* () {
      routeMock.mockReturnValueOnce(Effect.succeed(publishedRoute()));
      const model = yield* resolveRuntimeCurriculumRoute({
        curriculum: "merdeka",
        locale: "en",
        path: ["class-11", "mathematics"],
      });

      expect(
        readRuntimeCurriculumBreadcrumbs("Home", "Subjects", model)
      ).toEqual([
        { name: "Home", path: "" },
        { name: "Subjects", path: "/curriculum" },
        { name: "Kurikulum Merdeka", path: "/curriculum/merdeka" },
        { name: "Class 11", path: "/curriculum/merdeka/class-11" },
        {
          name: "Mathematics",
          path: "/curriculum/merdeka/class-11/mathematics",
        },
      ]);
      expect(readRuntimeCurriculumToc(model)).toEqual({
        description: "Class 11",
        publicPath: "curriculum/merdeka/class-11/mathematics",
        title: "Mathematics",
      });
    })
  );

  it("omits parent presentation for a root route", () => {
    const model = {
      alternates: [testProgramRoot],
      ancestors: [],
      childRoutes: [],
      locale: "en",
      materialCards: [],
      program: testPublishedProgram,
      route: testProgramRoot,
      sourcePath: testProgramRoot.sourcePath,
      sourceRevision: revision,
    } satisfies CurriculumRouteModel;

    expect(isRenderableCurriculumView(testProgramRoot)).toBe(true);
    expect(
      isRenderableCurriculumView({ ...testProgramRoot, sitemap: false })
    ).toBe(false);
    expect(readRuntimeCurriculumToc(model)).toEqual({
      publicPath: "curriculum/merdeka",
      title: "Kurikulum Merdeka",
    });
  });
});
