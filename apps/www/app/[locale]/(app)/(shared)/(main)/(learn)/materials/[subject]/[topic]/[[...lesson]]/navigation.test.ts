// @vitest-environment node

import {
  PublicPathSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MaterialPageContent } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/content";
import {
  readMaterialNavigation,
  toMaterialHref,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/navigation";
import {
  previewIdProjection,
  previewNextProjection,
  previewProjection,
} from "@/test/content-preview";

const getPublishedMaterialContext = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/material/context", () => ({
  getPublishedMaterialContext,
}));

const activeReleaseId = ReleaseIdSchema.make("release-material");
const metadata = previewProjection.metadata;
const context = {
  nodeKey: "class-11-mathematics-function-composition-inverse-function",
  programKey: "merdeka",
};
const publishedPage = {
  activeReleaseId,
  alternates: [previewProjection, previewIdProjection],
  body: "## Function Concept",
  children: "Function Concept",
  copySourceUrl: null,
  kind: "published",
  appLocale: "en",
  metadata,
  rendererDomain: "mathematics",
  route: previewProjection,
  siblings: [previewProjection, previewNextProjection],
  sourceUrl: null,
} satisfies MaterialPageContent;
const previewPage = {
  alternates: [previewProjection],
  body: "## Function Concept",
  children: "Function Concept",
  copySourceUrl: null,
  kind: "preview",
  appLocale: "en",
  metadata,
  rendererDomain: "mathematics",
  route: previewProjection,
  siblings: [previewProjection, previewNextProjection],
  sourceUrl: null,
} satisfies MaterialPageContent;
const emptyItem = { href: "", title: "" };

/** Builds one verified context response for the current signed material. */
function publishedContext(canonicalPath: typeof PublicPathSchema.Type) {
  return {
    context,
    group: {},
    href: "/en/curriculum/merdeka#functions",
    label: "Functions",
    mapping: { canonicalPath },
    parent: {},
  };
}

beforeEach(() => {
  getPublishedMaterialContext.mockReset();
});

describe("material lesson navigation", () => {
  it("builds canonical signed material hrefs", () => {
    expect(toMaterialHref(previewProjection)).toBe(
      `/${previewProjection.appLocale}/${previewProjection.publicPath}`
    );
  });

  it("orders signed siblings and handles pagination edges", async () => {
    await expect(
      readMaterialNavigation(publishedPage, undefined)
    ).resolves.toMatchObject({
      pagination: {
        next: {
          href: toMaterialHref(previewNextProjection),
          title: previewNextProjection.metadata.title,
        },
        prev: emptyItem,
      },
    });
    await expect(
      readMaterialNavigation(
        {
          ...publishedPage,
          route: previewNextProjection,
        },
        undefined
      )
    ).resolves.toMatchObject({
      pagination: {
        next: emptyItem,
        prev: { href: toMaterialHref(previewProjection) },
      },
    });
    await expect(
      readMaterialNavigation(
        {
          ...publishedPage,
          route: {
            ...previewProjection,
            publicPath: PublicPathSchema.make(
              `${previewProjection.parentPath}/missing`
            ),
          },
        },
        undefined
      )
    ).resolves.toMatchObject({
      pagination: { next: emptyItem, prev: emptyItem },
    });
  });

  it("uses canonical path as the tie breaker", async () => {
    const tiedNext = {
      ...previewNextProjection,
      order: previewProjection.order,
      publicPath: PublicPathSchema.make(`${previewProjection.parentPath}/z`),
    };
    await expect(
      readMaterialNavigation(
        { ...publishedPage, siblings: [tiedNext, previewProjection] },
        undefined
      )
    ).resolves.toMatchObject({
      pagination: { next: { href: toMaterialHref(tiedNext) } },
    });
  });

  it("does not resolve curriculum context for previews", async () => {
    await expect(
      readMaterialNavigation(previewPage, context)
    ).resolves.toMatchObject({
      context: undefined,
      link: undefined,
      pagination: {
        next: { href: toMaterialHref(previewNextProjection) },
      },
    });
    expect(getPublishedMaterialContext).not.toHaveBeenCalled();
  });

  it("preserves only a backend-verified published context", async () => {
    getPublishedMaterialContext.mockResolvedValue(
      publishedContext(previewProjection.parentPath)
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
        next: { href: expect.stringContaining("?ctx=merdeka~") },
      },
    });
    expect(getPublishedMaterialContext).toHaveBeenCalledWith(
      "en",
      previewProjection,
      context,
      activeReleaseId
    );
  });

  it("keeps unrelated siblings canonical and drops stale context", async () => {
    getPublishedMaterialContext
      .mockResolvedValueOnce(publishedContext(previewProjection.publicPath))
      .mockResolvedValueOnce(null);

    await expect(
      readMaterialNavigation(publishedPage, context)
    ).resolves.toMatchObject({
      pagination: {
        next: { href: toMaterialHref(previewNextProjection) },
      },
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
});
