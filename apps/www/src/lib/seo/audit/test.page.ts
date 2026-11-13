import { SITE_ORIGIN } from "@repo/seo/origin";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr } from "effect";

/** The address of the page that `writePage` writes unless a test names another. */
export const PAGE_PATH = "/id/materi/matematika/rotasi";

/** One crumb of a BreadcrumbList node, written as the head builders write it. */
export function crumb(position: number, name: string, path: string) {
  return { "@type": "ListItem", position, name, item: `${SITE_ORIGIN}${path}` };
}

/** A BreadcrumbList node of `crumbs`, as JSON-LD text. */
export function breadcrumbText(crumbs: readonly unknown[]) {
  return encodeJsonText({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs,
  });
}

/** The trail that every test page names unless it names another. */
export const TRAIL = [
  crumb(1, "Beranda", "/id"),
  crumb(2, "Kurikulum Merdeka", "/id/kurikulum/merdeka"),
  crumb(3, "Rotasi", PAGE_PATH),
];

/**
 * The HTML of one prerendered page as React and the router write it, with every
 * search fact in place. A test changes the part it is about.
 */
export function writePage(
  parts: {
    readonly alternates?: readonly (readonly [string, string])[];
    readonly body?: string;
    readonly canonical?: readonly string[];
    readonly description?: readonly string[];
    readonly jsonLd?: readonly string[];
    readonly path?: string;
    readonly robots?: readonly string[];
    readonly title?: readonly string[];
  } = {}
) {
  const path = parts.path ?? PAGE_PATH;
  const alternates = parts.alternates ?? [
    ["id", `${SITE_ORIGIN}${path}`],
    ["en", `${SITE_ORIGIN}/en/subjects/mathematics/rotation`],
    ["x-default", `${SITE_ORIGIN}/en/subjects/mathematics/rotation`],
  ];
  const head = Arr.join(
    [
      '<meta charSet="utf-8"/>',
      ...Arr.map(
        parts.title ?? ["Rotasi - Nakafa"],
        (title) => `<title>${title}</title>`
      ),
      ...Arr.map(
        parts.description ?? [
          "Putar titik dan grafik fungsi terhadap titik asal.",
        ],
        (content) => `<meta content="${content}" name="description"/>`
      ),
      ...Arr.map(
        parts.robots ?? ["index,follow,max-snippet:-1,max-image-preview:large"],
        (content) => `<meta content="${content}" name="robots"/>`
      ),
      ...Arr.map(
        parts.canonical ?? [`${SITE_ORIGIN}${path}`],
        (href) => `<link href="${href}" rel="canonical"/>`
      ),
      ...Arr.map(
        alternates,
        ([hreflang, href]) =>
          `<link href="${href}" rel="alternate" hreflang="${hreflang}"/>`
      ),
      '<link href="/rss.xml" rel="alternate" title="Nakafa" type="application/rss+xml"/>',
      ...Arr.map(
        parts.jsonLd ?? [breadcrumbText(TRAIL)],
        (text) => `<script type="application/ld+json">${text}</script>`
      ),
    ],
    ""
  );
  const body =
    parts.body ??
    '<nav aria-label="Breadcrumb" data-slot="breadcrumb"><ol><li><a data-slot="breadcrumb-link" href="/id/home">Beranda</a></li><li><a data-slot="breadcrumb-link" aria-current="page" href="/id/materi/matematika/rotasi">Rotasi</a></li></ol></nav><h1 class="text-4xl">Rotasi</h1>';
  return `<!DOCTYPE html><html dir="ltr" lang="id"><head>${head}</head><body>${body}</body></html>`;
}
