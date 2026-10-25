// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { CurriculumRouteSchema } from "@nakafa/aksara-contracts/program/curriculum";
import { Schema } from "effect";
import { createElement } from "react";
import {
  readMaterialNavigation,
  toMaterialHref,
  toMaterialNavigationPage,
} from "@/lib/content/material/navigation";
import type { PublishedMaterialContext } from "@/lib/content/material/projection";
import {
  previewNextProjection,
  previewProjection,
} from "@/test/content-preview";
import {
  testProgramContexts,
  testProgramGroups,
  testProgramSubject,
} from "@/test/content-program";

const metadata = previewProjection.metadata;
const context = {
  nodeKey: "class-11-mathematics-function-composition-inverse-function",
  programKey: "merdeka",
};
const publishedPage = {
  body: "## Function Concept",
  children: createElement("p", null, "Function Concept"),
  copySourceUrl: null,
  kind: "published" as const,
  appLocale: "en",
  metadata,
  rendererDomain: "mathematics",
  route: previewProjection,
  siblings: [previewProjection, previewNextProjection],
  sourceUrl: null,
};
const previewPage = {
  body: "## Function Concept",
  children: createElement("p", null, "Function Concept"),
  copySourceUrl: null,
  kind: "preview" as const,
  appLocale: "en",
  metadata,
  rendererDomain: "mathematics",
  route: previewProjection,
  siblings: [previewProjection, previewNextProjection],
  sourceUrl: null,
};
const emptyItem = { publicPath: "", title: "" };

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
    hash: "functions",
    label: "Functions",
    mapping: { ...mapping, canonicalPath },
    parent: testProgramSubject,
    resolvedCanonicalPath: canonicalPath,
  };
}

describe("material lesson navigation", () => {
  it("builds canonical signed material hrefs", () => {
    expect(toMaterialHref(previewProjection)).toBe(
      `/${previewProjection.appLocale}/${previewProjection.publicPath}`
    );
  });

  it("hands client controls route identity and sibling labels only", () => {
    const navigation = toMaterialNavigationPage(publishedPage);

    expect(navigation.kind).toBe("published");
    expect(navigation.route).toStrictEqual({
      appLocale: previewProjection.appLocale,
      contentKey: previewProjection.contentKey,
      materialKey: previewProjection.materialKey,
      parentPath: previewProjection.parentPath,
      publicPath: previewProjection.publicPath,
    });
    expect(navigation.siblings).toStrictEqual([
      {
        appLocale: previewProjection.appLocale,
        metadata: { title: previewProjection.metadata.title },
        order: previewProjection.order,
        parentPath: previewProjection.parentPath,
        publicPath: previewProjection.publicPath,
      },
      {
        appLocale: previewNextProjection.appLocale,
        metadata: { title: previewNextProjection.metadata.title },
        order: previewNextProjection.order,
        parentPath: previewNextProjection.parentPath,
        publicPath: previewNextProjection.publicPath,
      },
    ]);
  });

  it("orders signed siblings and handles pagination edges", () => {
    const missingRoute = {
      ...previewProjection,
      publicPath: PublicPathSchema.make(
        `${previewProjection.parentPath}/missing`
      ),
    };

    expect(readMaterialNavigation(publishedPage, null)).toMatchObject({
      pagination: {
        next: {
          publicPath: previewNextProjection.publicPath,
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
      pagination: {
        next: emptyItem,
        prev: { publicPath: previewProjection.publicPath },
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
      pagination: { next: { publicPath: tiedNext.publicPath } },
    });
  });

  it("orders equal authored order by canonical path in both input orders", () => {
    const tiedNext = {
      ...previewNextProjection,
      order: previewProjection.order,
      publicPath: PublicPathSchema.make(`${previewProjection.parentPath}/z`),
    };
    expect(
      readMaterialNavigation(
        { ...publishedPage, siblings: [previewProjection, tiedNext] },
        null
      )
    ).toMatchObject({
      pagination: { next: { publicPath: tiedNext.publicPath } },
    });
  });

  it("keeps the input order of siblings with the same canonical path", () => {
    const duplicate = {
      ...previewProjection,
      metadata: { ...previewProjection.metadata, title: "Duplicate" },
    };
    expect(
      readMaterialNavigation(
        { ...publishedPage, siblings: [previewProjection, duplicate] },
        null
      )
    ).toMatchObject({
      pagination: { next: { title: "Duplicate" } },
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
      link: undefined,
      pagination: {
        next: { publicPath: previewNextProjection.publicPath },
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
      link: {
        hash: "functions",
        publicPath: "curriculum/merdeka/class-11/mathematics",
        label: "Functions",
      },
      pagination: {
        next: { context: expect.stringContaining("merdeka~") },
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
      pagination: {
        next: { publicPath: previewNextProjection.publicPath },
      },
    });
    expect(readMaterialNavigation(publishedPage, null)).toMatchObject({
      context: undefined,
      link: undefined,
      pagination: {
        next: { publicPath: previewNextProjection.publicPath },
      },
    });
  });

  it.each(["parent", "lesson"] as const)(
    "keeps verified %s context when published material routes are renamed",
    (scope) => {
      const parentPath = PublicPathSchema.make(
        "subjects/mathematics/current-functions"
      );
      const route = {
        ...previewProjection,
        parentPath,
        publicPath: PublicPathSchema.make(`${parentPath}/function-concept`),
      };
      const next = {
        ...previewNextProjection,
        parentPath,
        publicPath: PublicPathSchema.make(`${parentPath}/function-properties`),
      };
      const signed = publishedContext(
        scope === "parent"
          ? previewProjection.parentPath
          : previewProjection.publicPath
      );
      const verified = {
        ...signed,
        resolvedCanonicalPath:
          scope === "parent" ? parentPath : route.publicPath,
      };

      expect(
        readMaterialNavigation(
          { ...publishedPage, route, siblings: [route, next] },
          verified
        )
      ).toMatchObject({
        context,
        pagination: {
          next: {
            ...(scope === "parent"
              ? { context: `merdeka~${context.nodeKey}` }
              : {}),
            publicPath: next.publicPath,
          },
        },
      });
    }
  );
});
