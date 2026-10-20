import { SITE_ORIGIN } from "@repo/seo/origin";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { Array as Arr, Record as Rec, Result } from "effect";
import { readLegalPageFn } from "@/lib/content/page/read.fn";

/**
 * A legal page, which Aksara publishes under its own path in each locale. The
 * loader reads its signed page: a path that no signed page answers is a 404
 * before the stream, and the head names the page's own alternates, because its
 * slug can differ from one locale to the next.
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
  head: ({ loaderData }) => {
    if (loaderData === undefined) {
      return {};
    }
    const languages: Readonly<Record<string, string | undefined>> =
      loaderData.alternates.languages;
    const markdown: string | undefined =
      loaderData.alternates.types?.["text/markdown"];
    return {
      links: [
        {
          href: new URL(loaderData.alternates.canonical, SITE_ORIGIN).href,
          rel: "canonical",
        },
        ...Arr.filterMap(Rec.toEntries(languages), ([hreflang, href]) =>
          href === undefined
            ? Result.failVoid
            : Result.succeed({
                href: new URL(href, SITE_ORIGIN).href,
                hreflang,
                rel: "alternate",
              })
        ),
        ...(markdown === undefined
          ? []
          : [
              {
                href: new URL(markdown, SITE_ORIGIN).href,
                rel: "alternate",
                type: "text/markdown",
              },
            ]),
      ],
      meta: [
        { title: loaderData.title },
        { content: loaderData.description, name: "description" },
      ],
    };
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
