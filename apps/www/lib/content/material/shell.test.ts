// @vitest-environment node

import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  expandMaterialCandidates,
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
          parentPath: previewPublicRoute.parentPath,
        },
        {
          contentKey: idRoute.sourcePath,
          locale: idRoute.locale,
          parentPath: idRoute.parentPath,
        },
        {
          contentKey: nextRoute.sourcePath,
          locale: nextRoute.locale,
          parentPath: nextRoute.parentPath,
        },
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
        parentPath: movedParentPath,
      },
      {
        contentKey: idRoute.sourcePath,
        locale: idRoute.locale,
        parentPath: idRoute.parentPath,
      },
      {
        contentKey: nextRoute.sourcePath,
        locale: nextRoute.locale,
        parentPath: nextRoute.parentPath,
      },
      {
        contentKey: movedRoute.sourcePath,
        locale: movedRoute.locale,
        parentPath: movedRoute.parentPath,
      },
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
        parentPath: previewPublicRoute.parentPath,
      },
      {
        contentKey: idRoute.sourcePath,
        locale: idRoute.locale,
        parentPath: idRoute.parentPath,
      },
      {
        contentKey: nextRoute.sourcePath,
        locale: nextRoute.locale,
        parentPath: nextRoute.parentPath,
      },
    ]);
  });

  it("expands one shell with active groups and preserves its fast path", () => {
    const candidates = [
      {
        contentKey: previewPublicRoute.sourcePath,
        locale: previewPublicRoute.locale,
        parentPath: previewPublicRoute.parentPath,
      },
      {
        contentKey: nextRoute.sourcePath,
        locale: nextRoute.locale,
        parentPath: nextRoute.parentPath,
      },
    ];

    expect(expandMaterialCandidates(candidates, [])).toBe(candidates);
    expect(
      expandMaterialCandidates(candidates, [
        {
          contentKey: previewProjection.contentKey,
          locale: previewProjection.locale,
          parentPath: movedParentPath,
        },
      ])
    ).toEqual([
      {
        contentKey: previewPublicRoute.sourcePath,
        locale: previewPublicRoute.locale,
        parentPath: movedParentPath,
      },
      {
        contentKey: nextRoute.sourcePath,
        locale: nextRoute.locale,
        parentPath: nextRoute.parentPath,
      },
      {
        contentKey: movedRoute.sourcePath,
        locale: movedRoute.locale,
        parentPath: movedRoute.parentPath,
      },
    ]);
  });

  it("adds a real locale counterpart absent from the source shell", () => {
    expect(
      readMaterialCandidates({
        contentKey: previewNextProjection.contentKey,
        locale: "id",
        parentPath: previewIdProjection.parentPath,
      })
    ).toEqual([
      {
        contentKey: previewPublicRoute.sourcePath,
        locale: "id",
        parentPath: idRoute.parentPath,
      },
      {
        contentKey: nextRoute.sourcePath,
        locale: nextRoute.locale,
        parentPath: nextRoute.parentPath,
      },
      {
        contentKey: previewNextProjection.contentKey,
        locale: "id",
        parentPath: idRoute.parentPath,
      },
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
