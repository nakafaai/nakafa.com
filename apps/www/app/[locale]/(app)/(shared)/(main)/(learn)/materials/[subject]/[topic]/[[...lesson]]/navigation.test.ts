// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  PublicPathSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { CurriculumRouteSchema } from "@nakafa/aksara-contracts/program/curriculum";
import { Schema } from "effect";
import type { MaterialPageContent } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/content";
import {
  readMaterialNavigation,
  toMaterialHref,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/navigation";
import type { PublishedMaterialContext } from "@/lib/content/material/context";
import {
  previewIdProjection,
  previewNextProjection,
  previewProjection,
} from "@/test/content-preview";
import {
  testProgramContexts,
  testProgramGroups,
  testProgramSubject,
} from "@/test/content-program";

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
function publishedContext(
  canonicalPath: typeof PublicPathSchema.Type
): PublishedMaterialContext {
  const [group] = Schema.decodeUnknownSync(
    Schema.Tuple([CurriculumRouteSchema])
  )(testProgramGroups);
  const [mapping] = Schema.decodeUnknownSync(
    Schema.Tuple([CurriculumRouteSchema])
  )(testProgramContexts);
  return {
    context,
    group,
    href: "/en/curriculum/merdeka#functions",
    label: "Functions",
    mapping: { ...mapping, canonicalPath },
    parent: testProgramSubject,
  };
}

describe("material lesson navigation", () => {
  it("builds canonical signed material hrefs", () => {
    expect(toMaterialHref(previewProjection)).toBe(
      `/${previewProjection.appLocale}/${previewProjection.publicPath}`
    );
  });

  it("orders signed siblings and handles pagination edges", () => {
    const missingRoute = {
      ...previewProjection,
      publicPath: PublicPathSchema.make(
        `${previewProjection.parentPath}/missing`
      ),
    };

    expect(readMaterialNavigation(publishedPage, null)).toMatchObject({
      currentHref: toMaterialHref(previewProjection),
      pagination: {
        next: {
          href: toMaterialHref(previewNextProjection),
          title: previewNextProjection.metadata.title,
        },
        prev: emptyItem,
      },
    });
    expect(
      readMaterialNavigation(
        {
          ...publishedPage,
          route: previewNextProjection,
        },
        null
      )
    ).toMatchObject({
      currentHref: toMaterialHref(previewNextProjection),
      pagination: {
        next: emptyItem,
        prev: { href: toMaterialHref(previewProjection) },
      },
    });
    expect(
      readMaterialNavigation(
        {
          ...publishedPage,
          route: missingRoute,
        },
        null
      )
    ).toMatchObject({
      currentHref: toMaterialHref(missingRoute),
      pagination: { next: emptyItem, prev: emptyItem },
    });
  });

  it("uses canonical path as the tie breaker", () => {
    const tiedNext = {
      ...previewNextProjection,
      order: previewProjection.order,
      publicPath: PublicPathSchema.make(`${previewProjection.parentPath}/z`),
    };
    expect(
      readMaterialNavigation(
        { ...publishedPage, siblings: [tiedNext, previewProjection] },
        null
      )
    ).toMatchObject({
      pagination: { next: { href: toMaterialHref(tiedNext) } },
    });
  });

  it("keeps preview navigation canonical even with a supplied context", () => {
    expect(
      readMaterialNavigation(
        previewPage,
        publishedContext(previewProjection.parentPath)
      )
    ).toMatchObject({
      context: undefined,
      currentHref: toMaterialHref(previewProjection),
      link: undefined,
      pagination: {
        next: { href: toMaterialHref(previewNextProjection) },
      },
    });
  });

  it("preserves only a backend-verified published context", () => {
    expect(
      readMaterialNavigation(
        publishedPage,
        publishedContext(previewProjection.parentPath)
      )
    ).toMatchObject({
      context,
      currentHref: `${toMaterialHref(previewProjection)}?ctx=merdeka~${context.nodeKey}`,
      link: {
        href: "/en/curriculum/merdeka#functions",
        label: "Functions",
      },
      pagination: {
        next: { href: expect.stringContaining("?ctx=merdeka~") },
      },
    });
  });

  it("keeps unrelated siblings canonical and drops stale context", () => {
    expect(
      readMaterialNavigation(
        publishedPage,
        publishedContext(previewProjection.publicPath)
      )
    ).toMatchObject({
      currentHref: `${toMaterialHref(previewProjection)}?ctx=merdeka~${context.nodeKey}`,
      pagination: {
        next: { href: toMaterialHref(previewNextProjection) },
      },
    });
    expect(readMaterialNavigation(publishedPage, null)).toMatchObject({
      context: undefined,
      currentHref: toMaterialHref(previewProjection),
      link: undefined,
      pagination: {
        next: { href: toMaterialHref(previewNextProjection) },
      },
    });
  });
});
