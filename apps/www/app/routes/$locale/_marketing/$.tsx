import { createFileRoute, notFound } from "@tanstack/react-router";
import { readLegalPageFn } from "@/lib/content/page/read.fn";
import { createSeoHead, toHeadAlternates, toRouterHead } from "@/lib/seo/head";

/**
 * A legal page, which Aksara publishes under its own path in each locale. The
 * loader reads its signed page: a path that no signed page answers is a 404
 * before the stream. The head takes the page's own title, description and
 * alternates from the loader, because its slug can differ from one locale to the
 * next, and it builds them with the head seam like every other page.
 */
export const Route = createFileRoute("/$locale/_marketing/$")({
  loader: async ({ params }) => {
    const facts = await readLegalPageFn({
      data: { locale: params.locale, publicPath: params._splat ?? "" },
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
    return toRouterHead(
      createSeoHead({
        absoluteTitle: loaderData.title,
        alternates: toHeadAlternates(loaderData.alternates),
        canonicalPath: loaderData.canonicalPath,
        description: loaderData.description,
        image: "/og.png",
        indexable: true,
        jsonLd: [],
        locale: params.locale,
        parts: [],
        type: "website",
      })
    );
  },
  component: LegalPage,
});

/**
 * The legal page body. Aksara's reviewed body is a React tree that the server
 * renders, and the route does not yet carry it to the browser: the content
 * lane decides between a server component and server HTML (blueprint 4.2).
 */
function LegalPage() {
  return <main className="mx-auto w-full max-w-3xl px-6 py-20" />;
}
