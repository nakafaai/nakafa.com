// @vitest-environment node

import { GitCommitShaSchema } from "@nakafa/aksara-contracts/ids";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type CurriculumRouteModel,
  isRenderableCurriculumView,
  listRuntimeCurriculumStaticParams,
  readRuntimeCurriculumBreadcrumbs,
  readRuntimeCurriculumCatalog,
  readRuntimeCurriculumOptions,
  readRuntimeCurriculumToc,
  resolveRuntimeCurriculumRoute,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/runtime";
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
const routesMock = vi.hoisted(() => vi.fn());
const routeMock = vi.hoisted(() => vi.fn());
const revision = GitCommitShaSchema.make("a".repeat(40));

vi.mock("@/lib/content/program/catalog", () => ({
  getPublishedProgramCatalog: catalogMock,
  getPublishedProgramRoutes: routesMock,
}));
vi.mock("@/lib/content/cache", () => ({
  applyContentRuntimeCache: vi.fn(),
}));
vi.mock("@/lib/content/program/route", () => ({
  getPublishedProgramRoute: routeMock,
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
    routesMock.mockReset();
    routeMock.mockReset();
  });

  it("builds static params from the signed route inventory", async () => {
    routesMock.mockResolvedValueOnce({
      routes: [
        testProgramRoot,
        testProgramClass,
        { ...testProgramSubject, sitemap: false },
      ],
      sourceRevision: revision,
    });

    await expect(listRuntimeCurriculumStaticParams("en")).resolves.toEqual([
      { curriculum: "merdeka" },
      { curriculum: "merdeka", path: ["class-11"] },
    ]);
  });

  it("resolves a signed route with published cards and hierarchy", async () => {
    routeMock.mockResolvedValueOnce(publishedRoute());

    const model = await resolveRuntimeCurriculumRoute(
      Promise.resolve({
        curriculum: "merdeka",
        locale: "en",
        path: ["class-11", "mathematics"],
      })
    );

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
  });

  it("fails closed when a signed route is absent", async () => {
    routeMock.mockResolvedValueOnce(publishedRoute({ route: null }));

    await expect(
      resolveRuntimeCurriculumRoute(
        Promise.resolve({ curriculum: "missing", locale: "en" })
      )
    ).rejects.toThrow();
  });

  it("reads signed root cards and selector values", async () => {
    catalogMock.mockResolvedValueOnce({
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
    });

    const catalog = await readRuntimeCurriculumCatalog("en");

    expect(catalog.entries).toHaveLength(1);
    expect(readRuntimeCurriculumOptions(catalog, "en")).toEqual([
      {
        countryCode: "ID",
        href: "/en/curriculum/merdeka",
        programKey: "merdeka",
        publicSlug: "merdeka",
        title: "Kurikulum Merdeka",
        value: "curriculum/merdeka",
      },
    ]);
  });

  it("builds route presentation from signed ancestors", async () => {
    routeMock.mockResolvedValueOnce(publishedRoute());
    const model = await resolveRuntimeCurriculumRoute(
      Promise.resolve({
        curriculum: "merdeka",
        locale: "en",
        path: ["class-11", "mathematics"],
      })
    );

    expect(readRuntimeCurriculumBreadcrumbs("Home", "Subjects", model)).toEqual(
      [
        { name: "Home", path: "" },
        { name: "Subjects", path: "/curriculum" },
        { name: "Kurikulum Merdeka", path: "/curriculum/merdeka" },
        { name: "Class 11", path: "/curriculum/merdeka/class-11" },
        {
          name: "Mathematics",
          path: "/curriculum/merdeka/class-11/mathematics",
        },
      ]
    );
    expect(readRuntimeCurriculumToc(model)).toEqual({
      description: "Class 11",
      href: "/en/curriculum/merdeka/class-11/mathematics",
      title: "Mathematics",
    });
  });

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
      href: "/en/curriculum/merdeka",
      title: "Kurikulum Merdeka",
    });
  });
});
