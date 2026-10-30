import { LOCALES } from "@repo/internationalization/src/locale";
import { Array as Arr } from "effect";
// The Vite config imports this module, and only package imports resolve there.
import { LLMS_CACHE_CONTROL } from "#www/src/lib/llms/cache";
import { SCHOOL_SHELL_PATH } from "#www/src/lib/routing/school/shell";
import type { HeaderRule, WwwHeader } from "#www/src/lib/security/headers";

/** A sitemap and a feed may live on a CDN for a day, and a stale copy is served while the next one renders. */
const DAY_CACHE_CONTROL =
  "public, max-age=0, s-maxage=86400, stale-while-revalidate=86400";

/** A social image lives on a CDN for an hour. It changes only when its route changes, and a route changes only with a release. */
const SOCIAL_IMAGE_CACHE_CONTROL =
  "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";

const SITEMAP_HEADERS: readonly WwwHeader[] = [
  { key: "Cache-Control", value: DAY_CACHE_CONTROL },
  { key: "Content-Type", value: "application/xml; charset=utf-8" },
];

const RSS_HEADERS: readonly WwwHeader[] = [
  { key: "Cache-Control", value: DAY_CACHE_CONTROL },
  { key: "Content-Type", value: "application/rss+xml; charset=utf-8" },
];

const LLMS_HEADERS: readonly WwwHeader[] = [
  { key: "Cache-Control", value: LLMS_CACHE_CONTROL },
  { key: "Content-Type", value: "text/markdown; charset=utf-8" },
];

const MANIFEST_HEADERS: readonly WwwHeader[] = [
  { key: "Content-Type", value: "application/manifest+json" },
];

/**
 * A static answer is binary, but the CDN compresses only text types, and an answer
 * is mostly text: one tenth of its bytes after compression. The browser reads it
 * as bytes, so the declared type changes nothing it decodes.
 */
const STATIC_ANSWER_HEADERS: readonly WwwHeader[] = [
  { key: "Content-Type", value: "text/plain; charset=utf-8" },
];

const SOCIAL_IMAGE_HEADERS: readonly WwwHeader[] = [
  { key: "Cache-Control", value: SOCIAL_IMAGE_CACHE_CONTROL },
];

/**
 * The social images of each locale. The rule names each locale's path, because a
 * splat before the locale segment matched no image of the emitted `_headers` file.
 */
const SOCIAL_IMAGE_RULES: readonly HeaderRule[] = Arr.map(
  LOCALES,
  (locale) => ({
    headers: SOCIAL_IMAGE_HEADERS,
    path: `/${locale}/og/*`,
  })
);

/**
 * The School shell answers every page of a school host through the Worker, which
 * marks it unindexed (ADR 0038). The same file is also an asset at its own
 * address on every host, where nothing links to it, so it says the same there.
 */
const SCHOOL_SHELL_HEADERS: readonly WwwHeader[] = [
  { key: "X-Robots-Tag", value: "noindex" },
];

/** A built asset's file name carries the hash of its content, so a browser keeps it for a year and never asks again. */
const ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";

/**
 * The page headers that only a document reads: its security policy and framing,
 * its referrer and permissions policies, the transport rule that the document
 * already set for the host, and the agent discovery links. A built script or
 * style applies none of them, yet a page fetches hundreds of them, each carrying
 * these bytes.
 */
const DOCUMENT_ONLY_HEADERS: readonly string[] = [
  "Content-Security-Policy",
  "X-Frame-Options",
  "Referrer-Policy",
  "Strict-Transport-Security",
  "Permissions-Policy",
  "Link",
  "X-Llms-Txt",
];

/**
 * The headers of the built assets under `/assets/`: cached for good, and without
 * the document-only headers that the page rule attaches to every address. They
 * keep the rest, such as the content type guard and the TDM reservation.
 */
const ASSET_HEADER_RULE: HeaderRule = {
  detach: DOCUMENT_ONLY_HEADERS,
  headers: [{ key: "Cache-Control", value: ASSET_CACHE_CONTROL }],
  path: "/assets/*",
};

/**
 * The headers of the files that the build writes, one rule per address pattern.
 * The Worker answers none of these addresses, so the static assets carry the
 * content type and the cache policy that each answer had.
 */
export const STATIC_HEADER_RULES: readonly HeaderRule[] = [
  ASSET_HEADER_RULE,
  { path: "/sitemap.xml", headers: SITEMAP_HEADERS },
  { path: "/sitemap/*", headers: SITEMAP_HEADERS },
  { path: "/rss.xml", headers: RSS_HEADERS },
  { path: "/llms.txt", headers: LLMS_HEADERS },
  { path: "/manifest.webmanifest", headers: MANIFEST_HEADERS },
  { path: "/_data/*", headers: STATIC_ANSWER_HEADERS },
  { path: SCHOOL_SHELL_PATH, headers: SCHOOL_SHELL_HEADERS },
  ...SOCIAL_IMAGE_RULES,
];
