import { LOCALES } from "@repo/internationalization/src/locale";
import { Array as Arr } from "effect";
// The Vite config imports this module, and only package imports resolve there.
import { LLMS_CACHE_CONTROL } from "#www/src/lib/llms/cache";
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
 * The headers of the files that the build writes, one rule per address pattern.
 * The Worker answers none of these addresses, so the static assets carry the
 * content type and the cache policy that each answer had.
 */
export const STATIC_HEADER_RULES: readonly HeaderRule[] = [
  { path: "/sitemap.xml", headers: SITEMAP_HEADERS },
  { path: "/sitemap/*", headers: SITEMAP_HEADERS },
  { path: "/rss.xml", headers: RSS_HEADERS },
  { path: "/llms.txt", headers: LLMS_HEADERS },
  { path: "/manifest.webmanifest", headers: MANIFEST_HEADERS },
  ...SOCIAL_IMAGE_RULES,
];
