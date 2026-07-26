// @vitest-environment node

import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
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
  previewV2Projection,
} from "@/test/content-preview";

const mocks = vi.hoisted(() => ({
  getMaterialIcon: vi.fn(),
  getPublishedMaterialContext: vi.fn(),
  readMaterialRoutes: vi.fn(),
  requireParentMaterialRoute: vi.fn(),
  resolveMaterialHeaderLink: vi.fn(),
  toContextualMaterialHref: vi.fn(),
}));

vi.mock("@repo/contents/_lib/curriculum/material", () => ({
  getMaterialIcon: mocks.getMaterialIcon,
}));
vi.mock("@repo/contents/_types/route/learning/static", () => ({
  readStaticPublicLearningIndex: () => ({
    resolveMaterialHeaderLink: mocks.resolveMaterialHeaderLink,
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
  kind: "published",
  locale: "en",
  metadata: previewMetadata,
  rendererDomain: "mathematics",
  route: previewProjection,
  siblings: [previewProjection, previewNextProjection],
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
  sourceUrl: null,
} satisfies MaterialPageSource;
const previewPage = {
  ...publishedPage,
  kind: "preview",
  rendererDomain: null,
} satisfies MaterialPageSource;
const nextPublicRoute = Schema.decodeUnknownSync(
  PublicMaterialLessonRouteSchema
)({
  description: previewNextProjection.metadata.description,
  kind: previewNextProjection.kind,
  locale: previewNextProjection.locale,
  materialKey: previewNextProjection.materialKey,
  order: previewNextProjection.order,
  parentPath: previewNextProjection.parentPath,
  publicPath: previewNextProjection.publicPath,
  sectionKey: previewNextProjection.sectionKey,
  sitemap: previewNextProjection.sitemap,
  sourcePath: previewNextProjection.contentKey,
  title: previewNextProjection.metadata.title,
});
const shortSourcePage = {
  ...sourcePage,
  route: Schema.decodeUnknownSync(PublicMaterialLessonRouteSchema)({
    ...previewPublicRoute,
    sourcePath: "material",
  }),
} satisfies MaterialPageSource;
const idPublicRoute = Schema.decodeUnknownSync(PublicMaterialLessonRouteSchema)(
  {
    description: previewIdProjection.metadata.description,
    kind: previewIdProjection.kind,
    locale: previewIdProjection.locale,
    materialKey: previewIdProjection.materialKey,
    order: previewIdProjection.order,
    parentPath: previewIdProjection.parentPath,
    publicPath: previewIdProjection.publicPath,
    sectionKey: previewIdProjection.sectionKey,
    sitemap: previewIdProjection.sitemap,
    sourcePath: previewIdProjection.contentKey,
    title: previewIdProjection.metadata.title,
  }
);
const context = {
  nodeKey: "class-11-mathematics-function-composition-inverse-function",
  programKey: "merdeka",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readMaterialRoutes.mockReturnValue([
    previewPublicRoute,
    nextPublicRoute,
  ]);
  mocks.requireParentMaterialRoute.mockReturnValue({
    title: previewProjection.topicTitle,
  });
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
        kind: "published",
        locale: "en",
        metadata: previewMetadata,
        route: previewProjection,
      })
    ).toEqual(publishedPage.alternates);
    expect(
      readMaterialAlternates({
        alternates: [],
        kind: "source",
        locale: "en",
        metadata: previewMetadata,
        route: previewPublicRoute,
      })
    ).toEqual([previewPublicRoute]);
    expect(readMaterialIcon(publishedPage)).toBe("material-icon");
    expect(readMaterialIcon(sourcePage)).toBe("material-icon");
    expect(readMaterialIcon(previewPage)).toBe("material-icon");
    expect(readMaterialIcon(shortSourcePage)).toBe("material-icon");
    expect(mocks.getMaterialIcon).toHaveBeenLastCalledWith("");
  });

  it("resolves retained v2 topic copy by exact source identity", () => {
    const retainedPage = {
      ...publishedPage,
      route: previewV2Projection,
    } satisfies MaterialPageSource;
    const wrongSourceRoute = Schema.decodeUnknownSync(
      PublicMaterialLessonRouteSchema
    )({
      ...previewPublicRoute,
      sourcePath: previewNextProjection.contentKey,
    });
    mocks.readMaterialRoutes.mockReturnValue([
      idPublicRoute,
      nextPublicRoute,
      wrongSourceRoute,
      previewPublicRoute,
    ]);

    expect(readMaterialParentTitle(retainedPage)).toBe(
      previewProjection.topicTitle
    );

    mocks.readMaterialRoutes.mockReturnValue([]);
    expect(() => readMaterialParentTitle(retainedPage)).toThrow(
      "lost its source route"
    );
  });

  it("builds plain published sibling pagination for direct visits", async () => {
    await expect(
      readMaterialNavigation(publishedPage, undefined)
    ).resolves.toEqual({
      context: undefined,
      link: undefined,
      pagination: {
        next: {
          href: toMaterialHref(previewNextProjection),
          title: previewNextProjection.metadata.title,
        },
        prev: { href: "", title: "" },
      },
    });
    expect(mocks.getPublishedMaterialContext).not.toHaveBeenCalled();
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
    ).resolves.toMatchObject({
      pagination: {
        next: { href: "", title: "" },
        prev: { href: "", title: "" },
      },
    });
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
    mocks.resolveMaterialHeaderLink.mockReturnValueOnce(link);
    mocks.toContextualMaterialHref.mockReturnValue(
      `${toMaterialHref(previewProjection)}?ctx=merdeka~functions`
    );

    await expect(
      readMaterialNavigation(publishedPage, context)
    ).resolves.toMatchObject({ context, link });

    mocks.resolveMaterialHeaderLink.mockReturnValueOnce(undefined);
    await expect(
      readMaterialNavigation(publishedPage, context)
    ).resolves.toMatchObject({
      context: undefined,
      link: undefined,
    });
  });

  it("rejects a projection that cannot enter the source context contract", async () => {
    const invalidPage = {
      ...publishedPage,
      route: {
        ...previewProjection,
        contentKey: ContentKeySchema.make("material:invalid"),
      },
    } satisfies MaterialPageSource;
    mocks.getPublishedMaterialContext.mockResolvedValue({
      managed: false,
      value: null,
    });

    await expect(readMaterialNavigation(invalidPage, context)).rejects.toThrow(
      "cannot use source curriculum context"
    );
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
  });

  it("drops an unverified source context", async () => {
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
