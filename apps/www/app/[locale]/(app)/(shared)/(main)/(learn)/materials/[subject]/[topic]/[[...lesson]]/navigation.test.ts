// @vitest-environment node
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import type { PublicLearningIndex } from "@repo/contents/_types/route/learning/public";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readMaterialAlternates,
  readMaterialContentKey,
  readMaterialIcon,
  readMaterialNavigation,
  readMaterialParentTitle,
  toMaterialHref,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/navigation";
import type { MaterialPageSource } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/source";
import {
  makePreviewPublicRoute,
  makePublishedMaterialContext,
  previewIdProjection,
  previewMetadata,
  previewNextProjection,
  previewProjection,
  previewPublicRoute,
} from "@/test/content-preview";

const mocks = vi.hoisted(() => ({
  getMaterialIcon: vi.fn(),
  getPublishedMaterialContext: vi.fn(),
  readMaterialRoutes: vi.fn(),
  requireParentMaterialRoute: vi.fn(),
  resolveMaterialHeaderLink: vi.fn(),
  resolveMaterialRouteBySource: vi.fn(),
  toContextualMaterialHref: vi.fn(),
}));
vi.mock("@repo/contents/_lib/curriculum/material", () => ({
  getMaterialIcon: mocks.getMaterialIcon,
}));
vi.mock("@repo/contents/_types/route/learning/static", () => ({
  readStaticPublicLearningIndex: () => ({
    resolveMaterialHeaderLink: mocks.resolveMaterialHeaderLink,
    resolveMaterialRouteBySource: mocks.resolveMaterialRouteBySource,
    toContextualMaterialHref: mocks.toContextualMaterialHref,
  }),
}));
vi.mock(
  "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/data",
  () => ({
    requireParentMaterialRoute: mocks.requireParentMaterialRoute,
  })
);
vi.mock("@/lib/content/material/shell", () => ({
  readMaterialRoutes: mocks.readMaterialRoutes,
}));
vi.mock("@/lib/content/material/context", () => ({
  getPublishedMaterialContext: mocks.getPublishedMaterialContext,
}));
const pageFields = {
  body: "## Function Concept",
  children: "Function Concept",
  locale: previewProjection.locale,
  metadata: previewMetadata,
  sourceClaims: [],
  sourceUrl: null,
};
const publishedPage = {
  alternates: [previewProjection, previewIdProjection],
  familyManaged: true,
  kind: "published",
  ...pageFields,
  rendererDomain: "mathematics",
  route: previewProjection,
  siblings: [previewProjection, previewNextProjection],
} satisfies MaterialPageSource;
const sourcePage = {
  alternates: [],
  kind: "source",
  ...pageFields,
  rendererDomain: null,
  route: previewPublicRoute,
  siblings: [],
} satisfies MaterialPageSource;
const previewPage = {
  ...publishedPage,
  alternates: [previewProjection],
  kind: "preview",
  rendererDomain: null,
} satisfies MaterialPageSource;
const nextPublicRoute = makePreviewPublicRoute(previewNextProjection);
const shortSourcePage = {
  ...sourcePage,
  route: makePreviewPublicRoute(previewProjection, { sourcePath: "material" }),
} satisfies MaterialPageSource;
const idPublicRoute = makePreviewPublicRoute(previewIdProjection);
const noOrderPrevRoute = makePreviewPublicRoute(previewNextProjection, {
  order: undefined,
  publicPath: `${previewProjection.parentPath}/a-first`,
  sourcePath: "material/a-first",
});
const noOrderNextRoute = makePreviewPublicRoute(previewNextProjection, {
  order: undefined,
  publicPath: `${previewProjection.parentPath}/z-last`,
  sourcePath: "material/z-last",
});
const context = {
  nodeKey: "class-11-mathematics-function-composition-inverse-function",
  programKey: "merdeka",
};
const emptyItem = { href: "", title: "" };
const emptyNavigation = {
  context: undefined,
  link: undefined,
  pagination: {
    next: emptyItem,
    prev: emptyItem,
  },
};
/** Builds one exact-owned page while its family shell remains source-owned. */
function makeExactPage(route = previewProjection): MaterialPageSource {
  return {
    ...publishedPage,
    familyManaged: false,
    route,
    siblings: [route],
  };
}

/** Builds one exact-owned source claim from its canonical projection. */
function foundClaim(projection: MaterialLessonProjection) {
  return {
    contentKey: projection.contentKey,
    kind: "found",
    locale: projection.locale,
    projection,
  } satisfies MaterialPageSource["sourceClaims"][number];
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readMaterialRoutes.mockReturnValue([
    previewPublicRoute,
    nextPublicRoute,
  ]);
  mocks.requireParentMaterialRoute.mockReturnValue({
    title: previewProjection.topicTitle,
  });
  mocks.resolveMaterialRouteBySource.mockImplementation(
    (
      ...[sourcePath, locale]: Parameters<
        PublicLearningIndex["resolveMaterialRouteBySource"]
      >
    ) =>
      [previewPublicRoute, nextPublicRoute, idPublicRoute].find(
        (route) => route.sourcePath === sourcePath && route.locale === locale
      )
  );
  mocks.getMaterialIcon.mockReturnValue("material-icon");
});

describe("material lesson navigation", () => {
  it("derives stable route, parent, locale, and renderer identities", () => {
    expect(toMaterialHref(previewProjection)).toBe(
      `/${previewProjection.locale}/${previewProjection.publicPath}`
    );
    expect(readMaterialContentKey(publishedPage)).toBe(
      previewProjection.contentKey
    );
    expect(readMaterialContentKey(sourcePage)).toBe(
      previewPublicRoute.sourcePath
    );
    expect(readMaterialParentTitle(publishedPage)).toBe(
      previewProjection.topicTitle
    );
    expect(readMaterialParentTitle(sourcePage)).toBe(
      previewProjection.topicTitle
    );
    expect(readMaterialAlternates(publishedPage)).toEqual(
      publishedPage.alternates
    );
    expect(readMaterialAlternates(previewPage)).toEqual([previewProjection]);
    expect(readMaterialAlternates(sourcePage)).toEqual([previewPublicRoute]);
    expect(readMaterialIcon(publishedPage)).toBe("material-icon");
    expect(readMaterialIcon(sourcePage)).toBe("material-icon");
    expect(readMaterialIcon(previewPage)).toBe("material-icon");
    expect(readMaterialIcon(shortSourcePage)).toBe("material-icon");
    expect(mocks.getMaterialIcon).toHaveBeenLastCalledWith("");
  });

  it("removes an exact-owned locale tombstone from the source shell", () => {
    mocks.readMaterialRoutes.mockReturnValue([
      previewPublicRoute,
      idPublicRoute,
      nextPublicRoute,
    ]);
    expect(
      readMaterialAlternates({
        alternates: [previewProjection],
        familyManaged: false,
        kind: "published",
        locale: "en",
        metadata: previewMetadata,
        route: previewProjection,
        sourceClaims: [
          {
            contentKey: previewNextProjection.contentKey,
            kind: "missing",
            locale: "en",
          },
          foundClaim(previewProjection),
          {
            contentKey: previewIdProjection.contentKey,
            kind: "missing",
            locale: "id",
          },
        ],
      })
    ).toEqual([previewProjection]);
  });

  it("removes an exact-owned sibling tombstone from pagination", async () => {
    await expect(
      readMaterialNavigation(
        {
          ...makeExactPage(),
          sourceClaims: [
            {
              contentKey: previewNextProjection.contentKey,
              kind: "missing",
              locale: "en",
            },
            foundClaim(previewIdProjection),
          ],
        },
        undefined
      )
    ).resolves.toEqual(emptyNavigation);
    mocks.resolveMaterialRouteBySource.mockReturnValue(undefined);
    await expect(
      readMaterialNavigation(makeExactPage(), undefined)
    ).resolves.toMatchObject({
      pagination: {
        next: { href: toMaterialHref(nextPublicRoute) },
        prev: { href: "", title: "" },
      },
    });
  });

  it("uses the active group after an exact owner moves between topics", async () => {
    const movedParentPath = PublicPathSchema.make(
      "subjects/mathematics/moved-functions"
    );
    const movedCurrent = {
      ...previewProjection,
      parentPath: movedParentPath,
      publicPath: PublicPathSchema.make(`${movedParentPath}/function-concept`),
    } satisfies MaterialLessonProjection;
    const movedSibling = makePreviewPublicRoute(previewNextProjection, {
      materialKey: movedCurrent.materialKey,
      parentPath: movedCurrent.parentPath,
      publicPath: `${movedCurrent.parentPath}/source-sibling`,
      sourcePath: "material/lesson/mathematics/moved-functions/source-sibling",
    });
    mocks.readMaterialRoutes.mockReturnValue([
      previewPublicRoute,
      nextPublicRoute,
      movedSibling,
    ]);

    await expect(
      readMaterialNavigation(
        {
          ...makeExactPage(movedCurrent),
          sourceClaims: [
            foundClaim(movedCurrent),
            {
              contentKey: previewNextProjection.contentKey,
              kind: "missing",
              locale: "en",
            },
          ],
        },
        undefined
      )
    ).resolves.toMatchObject({
      pagination: {
        next: {
          href: toMaterialHref(movedSibling),
          title: movedSibling.title,
        },
        prev: { href: "", title: "" },
      },
    });
  });

  it("orders source shell routes whose authored order is absent", async () => {
    mocks.readMaterialRoutes.mockReturnValue([
      noOrderPrevRoute,
      idPublicRoute,
      previewPublicRoute,
      noOrderNextRoute,
    ]);
    const current = {
      ...previewProjection,
      order: 0,
    } satisfies MaterialLessonProjection;
    await expect(
      readMaterialNavigation(
        {
          ...makeExactPage(current),
          sourceClaims: [foundClaim(previewNextProjection)],
        },
        undefined
      )
    ).resolves.toEqual({
      context: undefined,
      link: undefined,
      pagination: {
        next: {
          href: toMaterialHref(noOrderNextRoute),
          title: noOrderNextRoute.title,
        },
        prev: {
          href: toMaterialHref(noOrderPrevRoute),
          title: noOrderPrevRoute.title,
        },
      },
    });
  });

  it("handles tied order, a missing current row, and the final sibling", async () => {
    const tiedNext = {
      ...previewNextProjection,
      order: previewProjection.order,
    } satisfies MaterialLessonProjection;
    const missingCurrent = {
      ...publishedPage,
      siblings: [previewNextProjection],
    } satisfies MaterialPageSource;
    const finalPage = {
      ...publishedPage,
      metadata: previewNextProjection.metadata,
      route: previewNextProjection,
    } satisfies MaterialPageSource;
    await expect(
      readMaterialNavigation(
        { ...publishedPage, siblings: [tiedNext, previewProjection] },
        undefined
      )
    ).resolves.toMatchObject({
      pagination: {
        next: { href: toMaterialHref(tiedNext) },
      },
    });
    await expect(
      readMaterialNavigation(missingCurrent, undefined)
    ).resolves.toEqual(emptyNavigation);
    await expect(
      readMaterialNavigation(finalPage, undefined)
    ).resolves.toMatchObject({
      pagination: {
        next: { href: "", title: "" },
        prev: { href: toMaterialHref(previewProjection) },
      },
    });
  });

  it("preserves only a backend-verified published context", async () => {
    mocks.getPublishedMaterialContext.mockResolvedValue(
      makePublishedMaterialContext(context, previewProjection.parentPath)
    );
    await expect(
      readMaterialNavigation(publishedPage, context)
    ).resolves.toMatchObject({
      context,
      link: {
        href: "/en/curriculum/merdeka#functions",
        label: "Functions",
      },
      pagination: {
        next: {
          href: expect.stringContaining("?ctx=merdeka~"),
        },
      },
    });
    expect(mocks.getPublishedMaterialContext).toHaveBeenCalledWith(
      "en",
      previewProjection,
      context
    );
  });

  it("keeps an exact lesson context off sibling links", async () => {
    mocks.getPublishedMaterialContext.mockResolvedValue(
      makePublishedMaterialContext(context, previewProjection.publicPath)
    );
    await expect(
      readMaterialNavigation(publishedPage, context)
    ).resolves.toMatchObject({
      context,
      pagination: {
        next: { href: toMaterialHref(previewNextProjection) },
      },
    });
  });

  it("drops a stale published context and keeps canonical pagination", async () => {
    mocks.getPublishedMaterialContext.mockResolvedValue({
      managed: true,
      value: null,
    });
    await expect(
      readMaterialNavigation(publishedPage, context)
    ).resolves.toMatchObject({
      context: undefined,
      link: undefined,
      pagination: {
        next: { href: toMaterialHref(previewNextProjection) },
      },
    });
  });

  it("uses source context only while the program owner is unmanaged", async () => {
    const link = { href: "/en/curriculum/merdeka", label: "Mathematics" };
    mocks.getPublishedMaterialContext.mockResolvedValue({
      managed: false,
      value: null,
    });
    mocks.resolveMaterialHeaderLink.mockReturnValue(link);
    mocks.toContextualMaterialHref.mockReturnValue(
      `${toMaterialHref(previewProjection)}?ctx=merdeka~functions`
    );
    await expect(
      readMaterialNavigation(makeExactPage(), context)
    ).resolves.toMatchObject({ context, link });
    mocks.resolveMaterialRouteBySource.mockImplementation(
      (sourcePath: string) =>
        sourcePath === previewProjection.contentKey
          ? previewPublicRoute
          : undefined
    );
    await expect(
      readMaterialNavigation(publishedPage, context)
    ).resolves.toMatchObject({
      pagination: {
        next: { href: toMaterialHref(previewNextProjection) },
      },
    });
    mocks.resolveMaterialRouteBySource.mockReturnValue(undefined);
    await expect(
      readMaterialNavigation(publishedPage, context)
    ).resolves.toMatchObject({
      context: undefined,
      link: undefined,
    });
  });

  it("preserves the established source context model before cutover", async () => {
    const link = { href: "/en/curriculum/merdeka", label: "Mathematics" };
    mocks.resolveMaterialHeaderLink.mockReturnValue(link);
    mocks.toContextualMaterialHref.mockReturnValue(
      `${toMaterialHref(previewProjection)}?ctx=merdeka~functions`
    );

    await expect(
      readMaterialNavigation(sourcePage, context)
    ).resolves.toMatchObject({ context, link });
    expect(mocks.toContextualMaterialHref).toHaveBeenCalled();
    mocks.resolveMaterialRouteBySource.mockReturnValue(undefined);
    await expect(
      readMaterialNavigation(
        {
          ...sourcePage,
          sourceClaims: [foundClaim(previewNextProjection)],
        },
        context
      )
    ).resolves.toMatchObject({
      pagination: {
        next: { href: toMaterialHref(previewNextProjection) },
      },
    });
    mocks.toContextualMaterialHref.mockClear();
    mocks.resolveMaterialHeaderLink.mockReturnValue(undefined);
    await expect(
      readMaterialNavigation(sourcePage, context)
    ).resolves.toMatchObject({
      context: undefined,
      link: undefined,
    });
    expect(mocks.toContextualMaterialHref).not.toHaveBeenCalled();
  });
});
