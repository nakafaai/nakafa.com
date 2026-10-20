import { monospace } from "@repo/design-system/lib/monospace";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { cn } from "cn";
import {
  publicContentHeaders,
  readContentCacheTags,
} from "@/lib/content/delivery";
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
    return { ...facts, cacheTags: readContentCacheTags(["page"]) };
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
  headers: ({ loaderData }) =>
    loaderData === undefined
      ? undefined
      : publicContentHeaders(loaderData.cacheTags),
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
