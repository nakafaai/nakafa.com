import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import type { PublicLearningIndex } from "@repo/contents/_types/route/learning/public";
import * as publicLearningStatic from "@repo/contents/_types/route/learning/static";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readPublishedLocalizedHref } from "@/lib/routing/locale/published";
import {
  makePreviewPublicRoute,
  previewIdProjection,
  previewProjection,
  previewPublicRoute,
} from "@/test/content-preview";

const publishedMocks = vi.hoisted(() => ({
  materialContext: vi.fn(),
  materialRoute: vi.fn(),
  materialSource: vi.fn(),
  programRoute: vi.fn(),
  verifyReleasePin: vi.fn(),
}));
const emptyLearningIndex: PublicLearningIndex = {
  projectMaterialContextToLocale: () => undefined,
  projectRouteToLocale: () => undefined,
  resolveMaterialHeaderLink: () => undefined,
  resolveMaterialRouteBySource: () => undefined,
  resolveRouteByPath: () => undefined,
  toContextualMaterialHref: ({ href }) => href,
};

vi.mock("@/lib/content/material/context", () => ({
  readPublishedMaterialContext: publishedMocks.materialContext,
}));
vi.mock("@/lib/content/material/route", () => ({
  readPublishedMaterialRoute: publishedMocks.materialRoute,
}));
vi.mock("@/lib/content/material/release", () => ({
  verifyMaterialReleasePin: publishedMocks.verifyReleasePin,
}));
vi.mock("@/lib/content/material/shell", () => ({
  readMaterialSource: publishedMocks.materialSource,
}));
vi.mock("@/lib/content/program/route", () => ({
  readPublishedProgramRoute: publishedMocks.programRoute,
}));

beforeEach(() => {
  publishedMocks.materialContext.mockReset();
  publishedMocks.materialRoute.mockReset();
  publishedMocks.materialSource.mockReset().mockReturnValue({
    candidates: [
      {
        contentKey: previewProjection.contentKey,
        locale: previewProjection.locale,
      },
      {
        contentKey: previewIdProjection.contentKey,
        locale: previewIdProjection.locale,
      },
    ],
    route: previewPublicRoute,
  });
  publishedMocks.programRoute.mockReset();
  publishedMocks.verifyReleasePin
    .mockReset()
    .mockImplementation((releaseId) => Effect.succeed(releaseId));
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Reads one English material route through its Indonesian published target. */
function readHref(search = "") {
  return Effect.runSync(
    readPublishedLocalizedHref({
      currentLocale: "en",
      locale: "id",
      publicPath: previewProjection.publicPath,
      search,
    })
  );
}

describe("published localized route ownership", () => {
  it("reconciles unmanaged exact claims and missing source routes", () => {
    const renamed = {
      ...previewIdProjection,
      publicPath: PublicPathSchema.make(
        `${previewIdProjection.parentPath}/fungsi-berganti`
      ),
    };
    publishedMocks.materialRoute.mockReturnValue(
      Effect.succeed({
        managed: false,
        projection: null,
        sourceClaims: [
          {
            contentKey: previewProjection.contentKey,
            kind: "found",
            locale: "id",
            projection: renamed,
          },
        ],
      })
    );
    expect(readHref()).toBe(`/${renamed.publicPath}`);
    expect(publishedMocks.materialRoute).toHaveBeenCalledWith(
      previewProjection.locale,
      previewProjection.publicPath,
      expect.arrayContaining([
        {
          contentKey: previewProjection.contentKey,
          locale: previewIdProjection.locale,
        },
      ])
    );

    const context =
      "?ctx=merdeka~class-11-mathematics-function-composition-inverse-function";
    const targetRoute = makePreviewPublicRoute(renamed);
    publishedMocks.materialContext.mockReturnValueOnce(
      Effect.succeed({ managed: false, value: null })
    );
    vi.spyOn(
      publicLearningStatic,
      "loadStaticPublicLearningIndex"
    ).mockReturnValueOnce(
      Effect.succeed({
        ...emptyLearningIndex,
        projectMaterialContextToLocale: ({ context: projected }) => projected,
        resolveMaterialRouteBySource: (_sourcePath, locale) =>
          locale === "en" ? previewPublicRoute : targetRoute,
      })
    );
    expect(readHref(context)).toBe(`/${renamed.publicPath}${context}`);

    publishedMocks.materialRoute.mockReturnValue(
      Effect.succeed({
        managed: false,
        projection: null,
        sourceClaims: [
          {
            contentKey: previewProjection.contentKey,
            kind: "missing",
            locale: "id",
          },
        ],
      })
    );
    expect(() => readHref()).toThrow();

    publishedMocks.materialSource.mockReturnValueOnce({
      candidates: [],
      route: undefined,
    });
    expect(readHref()).toBeNull();
  });

  it("reconciles every partial exact material target state", () => {
    const partial = {
      activeReleaseId: "material-partial",
      alternates: [previewProjection],
      familyManaged: false,
      managed: true,
      projection: previewProjection,
      sourceClaims: [],
    };
    const found = {
      ...previewIdProjection,
      publicPath: `${previewIdProjection.parentPath}/renamed-function`,
    };
    /** Runs one authoritative refresh after the initial partial model. */
    const read = (refresh: object) => {
      publishedMocks.materialRoute
        .mockReturnValueOnce(Effect.succeed(partial))
        .mockReturnValueOnce(Effect.succeed(refresh));
      return readHref();
    };

    expect(read(partial)).toBe(`/${previewIdProjection.publicPath}`);
    const context =
      "?ctx=merdeka~class-11-mathematics-function-composition-inverse-function";
    publishedMocks.materialRoute
      .mockReturnValueOnce(Effect.succeed(partial))
      .mockReturnValueOnce(Effect.succeed(partial));
    publishedMocks.materialContext.mockReturnValueOnce(
      Effect.succeed({ managed: false, value: null })
    );
    expect(readHref(context)).toBe(
      `/${previewIdProjection.publicPath}${context}`
    );
    expect(
      read({ ...partial, alternates: [previewProjection, previewIdProjection] })
    ).toBe(`/${previewIdProjection.publicPath}`);
    expect(
      read({
        ...partial,
        sourceClaims: [
          {
            contentKey: previewProjection.contentKey,
            kind: "found",
            locale: previewIdProjection.locale,
            projection: found,
          },
        ],
      })
    ).toBe(`/${found.publicPath}`);
    expect(() =>
      read({
        ...partial,
        sourceClaims: [
          {
            contentKey: previewProjection.contentKey,
            kind: "missing",
            locale: previewIdProjection.locale,
          },
        ],
      })
    ).toThrow();
    expect(() =>
      read({ managed: false, projection: null, sourceClaims: [] })
    ).toThrow();
    expect(() =>
      read({ ...partial, activeReleaseId: "material-replaced" })
    ).toThrow();

    publishedMocks.materialRoute.mockReturnValue(Effect.succeed(partial));
    vi.spyOn(
      publicLearningStatic,
      "loadStaticPublicLearningIndex"
    ).mockReturnValueOnce(Effect.succeed(emptyLearningIndex));
    expect(() => readHref()).toThrow();
  });
});
