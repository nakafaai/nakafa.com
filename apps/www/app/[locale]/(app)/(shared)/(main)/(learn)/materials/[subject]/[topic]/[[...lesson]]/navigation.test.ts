// @vitest-environment node
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import type { PublicLearningIndex } from "@repo/contents/_types/route/learning/public";
import { PublicMaterialLessonRouteSchema } from "@repo/contents/_types/route/schema";
import { Schema } from "effect";
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
    readMaterialRoutes: mocks.readMaterialRoutes,
    requireParentMaterialRoute: mocks.requireParentMaterialRoute,
  })
);
vi.mock("@/lib/content/material/context", () => ({
  getPublishedMaterialContext: mocks.getPublishedMaterialContext,
}));
const body = "Function Concept";
const publishedPage = {
  alternates: [previewProjection, previewIdProjection],
  body: "## Function Concept",
  children: body,
  familyManaged: true,
  kind: "published",
  locale: "en",
  metadata: previewMetadata,
  rendererDomain: "mathematics",
  route: previewProjection,
  siblings: [previewProjection, previewNextProjection],
  sourceClaims: [],
  sourceUrl: null,
} satisfies MaterialPageSource;
const sourcePage = {
  alternates: [],
  body: "## Function Concept",
  children: body,
  kind: "source",
  locale: "en",
  metadata: previewMetadata,
  rendererDomain: null,
  route: previewPublicRoute,
  siblings: [],
  sourceClaims: [],
  sourceUrl: null,
} satisfies MaterialPageSource;
const previewPage = {
  ...publishedPage,
  kind: "preview",
  rendererDomain: null,
} satisfies MaterialPageSource;
/** Adapts one published projection into the source route contract. */
function makePublicRoute(
  projection: MaterialLessonProjection,
  overrides: Partial<
    Schema.Schema.Encoded<typeof PublicMaterialLessonRouteSchema>
  > = {}
) {
  return Schema.decodeUnknownSync(PublicMaterialLessonRouteSchema)({
    description: projection.metadata.description,
    kind: projection.kind,
    locale: projection.locale,
    materialKey: projection.materialKey,
    order: projection.order,
    parentPath: projection.parentPath,
    publicPath: projection.publicPath,
    sectionKey: projection.sectionKey,
    sitemap: projection.sitemap,
    sourcePath: projection.contentKey,
    title: projection.metadata.title,
    ...overrides,
  });
}

const nextPublicRoute = makePublicRoute(previewNextProjection);
const shortSourcePage = {
  ...sourcePage,
  route: makePublicRoute(previewProjection, { sourcePath: "material" }),
} satisfies MaterialPageSource;
const idPublicRoute = makePublicRoute(previewIdProjection);
const noOrderPrevRoute = makePublicRoute(previewNextProjection, {
  order: undefined,
  publicPath: `${previewProjection.parentPath}/a-first`,
  sourcePath: "material/a-first",
});
const noOrderNextRoute = makePublicRoute(previewNextProjection, {
  order: undefined,
  publicPath: `${previewProjection.parentPath}/z-last`,
  sourcePath: "material/z-last",
});
const context = {
  nodeKey: "class-11-mathematics-function-composition-inverse-function",
  programKey: "merdeka",
};
const emptyNavigation = {
  context: undefined,
  link: undefined,
  pagination: {
    next: { href: "", title: "" },
    prev: { href: "", title: "" },
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
    expect(
      readMaterialAlternates({
        alternates: publishedPage.alternates,
        familyManaged: true,
        kind: "published",
        locale: "en",
        metadata: previewMetadata,
        route: previewProjection,
        sourceClaims: [],
      })
    ).toEqual(publishedPage.alternates);
    expect(
      readMaterialAlternates({
        alternates: [previewProjection],
        kind: "preview",
        locale: "en",
        metadata: previewMetadata,
        route: previewProjection,
        sourceClaims: [],
      })
    ).toEqual([previewProjection]);
    expect(
      readMaterialAlternates({
        alternates: [],
        kind: "source",
        locale: "en",
        metadata: previewMetadata,
        route: previewPublicRoute,
        sourceClaims: [],
      })
    ).toEqual([previewPublicRoute]);
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
    ).resolves.toEqual(emptyNavigation);
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
    mocks.getPublishedMaterialContext.mockResolvedValue({
      managed: true,
      value: {
        context,
        group: {},
        href: "/en/curriculum/merdeka#functions",
        label: "Functions",
        mapping: { canonicalPath: previewProjection.parentPath },
        parent: {},
      },
    });
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
    mocks.getPublishedMaterialContext.mockResolvedValue({
      managed: true,
      value: {
        context,
        group: {},
        href: "/en/curriculum/merdeka#functions",
        label: "Functions",
        mapping: { canonicalPath: previewProjection.publicPath },
        parent: {},
      },
    });
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
