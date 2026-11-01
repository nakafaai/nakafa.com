import { monospace } from "@repo/design-system/lib/monospace";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { makeArticleJsonLd } from "@repo/seo/json-ld/article";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { cn } from "cn";
import { PUBLIC_CONTENT_HEADERS } from "@/lib/content/delivery";
import { readLegalPageFn } from "@/lib/content/page/read.functions";
import { createSeoHead, toHeadAlternates, toRouterHead } from "@/lib/seo/head";
import { readStaticData } from "@/lib/static/data";

/** The social image of a legal page, which has no artwork of its own. */
const LEGAL_PAGE_IMAGE = "/og.png";

/**
 * A legal page, which Aksara publishes under its own path in each locale. The
 * loader reads its signed page: a path that no signed page answers is a 404
 * before the stream. The head takes the page's own metadata and alternates from
 * the loader, because its slug can differ from one locale to the next, and it
 * builds them with the head seam like every other page. The signed metadata
 * describes the document, so the page declares it as an article under the site's
 * root. It names no author, because these pages speak for the company.
 */
export const Route = createFileRoute("/$locale/_marketing/$")({
  loader: async ({ params }) => {
    const facts = await readStaticData(readLegalPageFn, {
      locale: params.locale,
      publicPath: params._splat ?? "",
    });
    if (facts._tag === "Missing") {
      throw notFound();
    }
    return facts;
  },
  head: ({ loaderData, params }) => {
    if (loaderData === undefined) {
      return {};
    }
    const { canonicalPath, metadata } = loaderData;
    return toRouterHead(
      createSeoHead({
        alternates: toHeadAlternates(loaderData.alternates),
        canonicalPath,
        description: metadata.description,
        image: LEGAL_PAGE_IMAGE,
        indexable: true,
        jsonLd: [
          makeArticleJsonLd({
            authors: [],
            dates: metadata,
            description: metadata.description,
            headline: metadata.title,
            image: LEGAL_PAGE_IMAGE,
            locale: params.locale,
            path: canonicalPath,
            trail: [
              { name: COMPANY_IDENTITY.brandName, path: `/${params.locale}` },
            ],
          }),
        ],
        locale: params.locale,
        parts: [metadata.title],
        type: "website",
      })
    );
  },
  headers: ({ loaderData }) =>
    loaderData === undefined ? undefined : PUBLIC_CONTENT_HEADERS,
  component: LegalPage,
});

/** The legal page: the reviewed body, which the server renders as a server component tree. */
function LegalPage() {
  const { body } = Route.useLoaderData();
  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-20">
      <div className={cn(monospace, "contents")}>{body}</div>
    </article>
  );
}
