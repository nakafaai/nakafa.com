// @vitest-environment node

import { GitCommitShaSchema } from "@nakafa/aksara-contracts/ids";
import { MaterialLessonProjectionSchema } from "@nakafa/aksara-contracts/projection/material";
import { InvalidPublicRouteSourceError } from "@repo/contents/_types/route/error";
import { Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type CurriculumRouteModel,
  isRenderableCurriculumView,
  listRuntimeCurriculumStaticParams,
  readRuntimeCurriculumBreadcrumbs,
  readRuntimeCurriculumCatalog,
  readRuntimeCurriculumHeader,
  readRuntimeCurriculumOptions,
  readRuntimeCurriculumToc,
  requireSourceCurriculumProgram,
  resolveRuntimeCurriculumRoute,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/runtime";
import type { MaterialSourceModel } from "@/lib/content/material/ownership";
import {
  previewNextProjection,
  previewProjection,
} from "@/test/content-preview";
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
const materialShellMock = vi.hoisted(() => vi.fn());
const expandCandidatesMock = vi.hoisted(() => vi.fn());
const revision = GitCommitShaSchema.make("a".repeat(40));

vi.mock("@/lib/content/program/catalog", () => ({
  getPublishedProgramCatalog: catalogMock,
  getPublishedProgramRoutes: routesMock,
}));
vi.mock("@/lib/content/program/route", () => ({
  getPublishedProgramRoute: routeMock,
}));
vi.mock("@/lib/content/material/route", () => ({
  getPublishedMaterialShell: materialShellMock,
}));
vi.mock("@/lib/content/material/shell", async (importOriginal) => ({
  ...(await importOriginal()),
  expandMaterialCandidates: expandCandidatesMock,
}));
vi.mock("@/lib/content/cache", () => ({
  applyContentRuntimeCache: vi.fn(),
}));

/** Builds one complete published route response for runtime selection. */
function publishedRoute(overrides?: {
  readonly children?: readonly (typeof testProgramClass)[];
  readonly managed?: boolean;
  readonly route?: null | typeof testProgramSubject;
}) {
  return {
    activeReleaseId: "program-release",
    alternates: [testProgramSubject],
    ancestors: [testProgramRoot, testProgramClass],
    children: overrides?.children ?? [],
    contexts: testProgramContexts,
    groups: testProgramGroups,
    managed: overrides?.managed ?? true,
    materials: [previewProjection],
    program: overrides?.route === null ? null : testPublishedProgram,
    route:
      overrides?.route === undefined ? testProgramSubject : overrides.route,
    sourceRevision: revision,
  };
}

describe("curriculum runtime ownership", () => {
  beforeEach(() => {
    catalogMock.mockReset();
    routesMock.mockReset();
    routeMock.mockReset();
    expandCandidatesMock
      .mockReset()
      .mockImplementation((candidates) => candidates);
    materialShellMock.mockReset().mockResolvedValue({
      claims: [],
      materials: [],
    });
  });

  it("builds static params from the managed published route inventory", async () => {
    routesMock.mockResolvedValueOnce({
      managed: true,
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

  it("keeps source static params while the family is unmanaged", async () => {
    routesMock.mockResolvedValueOnce({
      managed: false,
      routes: [],
      sourceRevision: null,
    });

    const params = await listRuntimeCurriculumStaticParams("id");

    expect(params).toContainEqual({ curriculum: "merdeka" });
    expect(params).toContainEqual({
      curriculum: "merdeka",
      path: ["kelas-10", "biologi"],
    });
  });

  it("resolves a managed route with published cards and hierarchy", async () => {
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
      managed: true,
      materialCards: [{ items: [{ title: "Function Concept" }] }],
      route: { publicPath: testProgramSubject.publicPath },
      sourcePath: "packages/corpus/curriculum/merdeka",
      sourceRevision: revision,
    });
  });

  it("resolves a real source route while the family is unmanaged", async () => {
    routeMock.mockResolvedValueOnce(
      publishedRoute({ managed: false, route: null })
    );

    const model = await resolveRuntimeCurriculumRoute(
      Promise.resolve({ curriculum: "merdeka", locale: "id" })
    );

    expect(model).toMatchObject({
      managed: false,
      program: { key: "merdeka" },
      route: { publicPath: "kurikulum/merdeka" },
      sourcePath: "packages/contents/curriculum/merdeka",
      sourceRevision: null,
    });
  });

  it("replaces one source curriculum card through exact material ownership", async () => {
    routeMock.mockResolvedValueOnce(
      publishedRoute({ managed: false, route: null })
    );
    const renamed = Schema.decodeUnknownSync(MaterialLessonProjectionSchema)({
      ...previewProjection,
      metadata: {
        ...previewProjection.metadata,
        title: "Function Overview",
      },
      publicPath:
        "subjects/mathematics/function-composition-inverse-function/function-overview",
    });
    materialShellMock.mockResolvedValueOnce({
      claims: [
        {
          contentKey: previewProjection.contentKey,
          kind: "found",
          locale: "en",
          projection: renamed,
        },
        {
          contentKey: previewNextProjection.contentKey,
          kind: "missing",
          locale: "en",
        },
      ],
      materials: [renamed],
    });

    const model = await resolveRuntimeCurriculumRoute(
      Promise.resolve({
        curriculum: "merdeka",
        locale: "en",
        path: ["class-11", "mathematics"],
      })
    );
    const items = model.materialCards.flatMap((card) => card.items);

    expect(items).toContainEqual(
      expect.objectContaining({
        href: expect.stringContaining(
          "/en/subjects/mathematics/function-composition-inverse-function/function-overview"
        ),
        title: "Function Overview",
      })
    );
    expect(items).not.toContainEqual(
      expect.objectContaining({ title: "Function Concept" })
    );
    expect(materialShellMock).toHaveBeenCalledWith(
      "en",
      expect.arrayContaining([
        {
          contentKey: previewProjection.contentKey,
          locale: "en",
          parentPath: previewProjection.parentPath,
        },
      ]),
      "program-release"
    );
  });

  it("rereads expanded exact groups under one release pin", async () => {
    routeMock.mockResolvedValueOnce(
      publishedRoute({ managed: false, route: null })
    );
    const materialModel = {
      claims: [
        {
          contentKey: previewProjection.contentKey,
          kind: "found",
          locale: previewProjection.locale,
          projection: previewProjection,
        },
        {
          contentKey: previewNextProjection.contentKey,
          kind: "found",
          locale: previewNextProjection.locale,
          projection: previewNextProjection,
        },
      ],
      materials: [previewProjection, previewNextProjection],
    } satisfies MaterialSourceModel;
    const expandedCandidates = [previewProjection, previewNextProjection].map(
      (projection) => ({
        contentKey: projection.contentKey,
        locale: projection.locale,
        parentPath: projection.parentPath,
      })
    );
    expandCandidatesMock.mockReturnValueOnce(expandedCandidates);
    materialShellMock
      .mockResolvedValueOnce(materialModel)
      .mockResolvedValueOnce(materialModel);

    const model = await resolveRuntimeCurriculumRoute(
      Promise.resolve({
        curriculum: "merdeka",
        locale: "en",
        path: ["class-11", "mathematics"],
      })
    );

    expect(model.materialCards.flatMap((card) => card.items)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: previewProjection.metadata.title }),
        expect.objectContaining({
          title: previewNextProjection.metadata.title,
        }),
      ])
    );
    expect(materialShellMock).toHaveBeenCalledTimes(2);
    expect(materialShellMock).toHaveBeenLastCalledWith(
      "en",
      expect.arrayContaining([
        {
          contentKey: previewProjection.contentKey,
          locale: previewProjection.locale,
          parentPath: previewProjection.parentPath,
        },
        {
          contentKey: previewNextProjection.contentKey,
          locale: previewNextProjection.locale,
          parentPath: previewNextProjection.parentPath,
        },
      ]),
      "program-release"
    );
  });

  it("fails closed when a managed route is absent", async () => {
    routeMock.mockResolvedValueOnce(publishedRoute({ route: null }));

    await expect(
      resolveRuntimeCurriculumRoute(
        Promise.resolve({ curriculum: "missing", locale: "en" })
      )
    ).rejects.toThrow();
  });

  it("reads the managed root catalog and source-owned selector values", async () => {
    catalogMock.mockResolvedValueOnce({
      entries: [
        { program: testPublishedProgram, route: testProgramRoot },
        {
          program: testPublishedProgram,
          route: { ...testProgramRoot, sitemap: false },
        },
      ],
      managed: true,
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

  it("reads source root cards while the family is unmanaged", async () => {
    catalogMock.mockResolvedValueOnce({
      entries: [],
      managed: false,
      sourceRevision: null,
    });

    const catalog = await readRuntimeCurriculumCatalog("id");

    expect(catalog.managed).toBe(false);
    expect(catalog.entries.map(({ route }) => route.programKey)).toEqual([
      "merdeka",
      "cambridge-international",
      "singapore-moe",
      "united-states",
    ]);
  });

  it("builds route presentation helpers from resolved ancestors", async () => {
    routeMock.mockResolvedValueOnce(publishedRoute());
    const model = await resolveRuntimeCurriculumRoute(
      Promise.resolve({
        curriculum: "merdeka",
        locale: "en",
        path: ["class-11", "mathematics"],
      })
    );

    expect(readRuntimeCurriculumHeader(model)).toEqual({
      href: "/en/curriculum/merdeka/class-11",
      label: "Class 11",
    });
    expect(readRuntimeCurriculumBreadcrumbs("Home", model)).toEqual([
      { name: "Home", path: "" },
      { name: "Kurikulum Merdeka", path: "/curriculum/merdeka" },
      { name: "Class 11", path: "/curriculum/merdeka/class-11" },
      {
        name: "Mathematics",
        path: "/curriculum/merdeka/class-11/mathematics",
      },
    ]);
    expect(readRuntimeCurriculumToc(model)).toEqual({
      description: "Class 11",
      href: "/en/curriculum/merdeka/class-11/mathematics",
      title: "Mathematics",
    });
  });

  it("omits parent presentation for one root route", () => {
    const model = {
      alternates: [testProgramRoot],
      ancestors: [],
      childGroups: [],
      childRoutes: [],
      locale: "en",
      managed: true,
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
    expect(readRuntimeCurriculumHeader(model)).toBeUndefined();
    expect(readRuntimeCurriculumToc(model)).toEqual({
      href: "/en/curriculum/merdeka",
      title: "Kurikulum Merdeka",
    });
  });

  it("preserves a missing source program as a typed route error", () => {
    expect(() =>
      requireSourceCurriculumProgram("missing-program")
    ).toThrowError(InvalidPublicRouteSourceError);
  });
});
