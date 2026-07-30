// @vitest-environment node

import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readMaterialCandidates,
  readMaterialRoutes,
  readMaterialSource,
} from "@/lib/content/material/shell";
import {
  makePreviewPublicRoute,
  previewIdProjection,
  previewNextProjection,
  previewProjection,
  previewPublicRoute,
} from "@/test/content-preview";

const mocks = vi.hoisted(() => ({
  readStaticPublicContentRoutes: vi.fn(),
  resolveMaterialRouteBySource: vi.fn(),
  resolveRouteByPath: vi.fn(),
}));

vi.mock("@repo/contents/_types/route/content/static", () => ({
  readStaticPublicContentRoutes: mocks.readStaticPublicContentRoutes,
}));
vi.mock("@repo/contents/_types/route/learning/static", () => ({
  readStaticPublicLearningIndex: () => ({
    resolveMaterialRouteBySource: mocks.resolveMaterialRouteBySource,
    resolveRouteByPath: mocks.resolveRouteByPath,
  }),
}));

const idRoute = makePreviewPublicRoute(previewIdProjection);
const nextRoute = makePreviewPublicRoute(previewNextProjection);
const movedParentPath = PublicPathSchema.make(
  "subjects/mathematics/moved-functions"
);
const movedRoute = makePreviewPublicRoute(previewNextProjection, {
  parentPath: movedParentPath,
  publicPath: `${movedParentPath}/moved-section`,
  sourcePath: "material/lesson/mathematics/moved-functions/moved-section",
});
const routes = [previewPublicRoute, idRoute, nextRoute, movedRoute];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readStaticPublicContentRoutes.mockReturnValue(routes);
  mocks.resolveMaterialRouteBySource.mockReturnValue(previewPublicRoute);
  mocks.resolveRouteByPath.mockReturnValue(previewPublicRoute);
});

describe("material source shell", () => {
  it("resolves the current route, locale counterpart, and source siblings", () => {
    expect(
      readMaterialSource("en", previewProjection.publicPath)
    ).toMatchObject({
      candidates: [
        {
          contentKey: previewPublicRoute.sourcePath,
          locale: previewPublicRoute.locale,
        },
        { contentKey: idRoute.sourcePath, locale: idRoute.locale },
        { contentKey: nextRoute.sourcePath, locale: nextRoute.locale },
      ],
      route: previewPublicRoute,
    });
    expect(readMaterialRoutes()).toEqual(routes);
    expect(mocks.readStaticPublicContentRoutes).toHaveBeenCalledOnce();
  });

  it("includes both original and active groups after an exact move", () => {
    expect(
      readMaterialCandidates({
        contentKey: previewProjection.contentKey,
        locale: previewProjection.locale,
        parentPath: movedParentPath,
      })
    ).toEqual([
      {
        contentKey: previewPublicRoute.sourcePath,
        locale: previewPublicRoute.locale,
      },
      { contentKey: idRoute.sourcePath, locale: idRoute.locale },
      { contentKey: nextRoute.sourcePath, locale: nextRoute.locale },
      { contentKey: movedRoute.sourcePath, locale: movedRoute.locale },
    ]);

    mocks.resolveMaterialRouteBySource.mockReturnValue(undefined);
    expect(
      readMaterialCandidates({
        contentKey: previewProjection.contentKey,
        locale: previewProjection.locale,
        parentPath: previewProjection.parentPath,
      })
    ).toEqual([
      {
        contentKey: previewPublicRoute.sourcePath,
        locale: previewPublicRoute.locale,
      },
      { contentKey: idRoute.sourcePath, locale: idRoute.locale },
      { contentKey: nextRoute.sourcePath, locale: nextRoute.locale },
    ]);
  });

  it("returns an empty shell for a non-material route", () => {
    mocks.resolveRouteByPath.mockReturnValue({
      ...previewPublicRoute,
      kind: "article-category",
    });

    expect(readMaterialSource("en", previewProjection.publicPath)).toEqual({
      candidates: [],
      route: undefined,
    });
  });
});
