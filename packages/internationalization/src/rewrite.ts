import {
  isSchoolLabel,
  type TenantSlug,
} from "@repo/backend/confect/tenancy/slug";
import {
  decodeLocale,
  type Locale,
} from "@repo/internationalization/src/locale";
import {
  publicSegment,
  readCanonicalName,
  readCanonicalSpelling,
} from "@repo/internationalization/src/pathnames";
import { SCHOOL_CELL_DOMAINS } from "@repo/site/domains";
import { Array as Arr, HashSet, Option, Record as Rec } from "effect";

/**
 * One rewrite function, as `createRouter({ rewrite })` calls it. It returns a
 * new URL and never changes the URL it receives.
 */
type RewriteFunction = ({ url }: { url: URL }) => URL;

/** One router rewrite: the input maps a browser URL to the router's URL, and the output maps back. */
interface RouteRewrite {
  readonly input: RewriteFunction;
  readonly output: RewriteFunction;
}

/** The domain of a local development server. Browsers resolve every `*.localhost` name to loopback. */
const LOCAL_DOMAIN = "localhost";

/** The domains that serve school hosts: the production cells, then the local domain. */
const SCHOOL_DOMAINS: readonly string[] = [
  ...Rec.values(SCHOOL_CELL_DOMAINS),
  LOCAL_DOMAIN,
];

/** The segment of the router tree that holds every school page. */
const SCHOOL_SEGMENT = "school";

/** The school address that a reserved label takes on the main host, so no school can be named `new`. */
const SCHOOL_START_SEGMENT = "new";

/**
 * The first path segments that every host answers the same way, so a school
 * host never rewrites them into the school tree.
 */
const SHARED_FIRST_SEGMENTS = HashSet.fromIterable([
  ".well-known",
  "_nakafa",
  "_serverFn",
  "api",
  "assets",
  "llms.mdx",
  "mcp",
  "og",
  "sitemap",
]);

/** The root files that every host answers the same way. */
const SHARED_ROOT_FILES = HashSet.fromIterable([
  "/e22d548f7fd2482a9022e3b84e944901.txt",
  "/llms.txt",
  "/logo.svg",
  "/manifest.webmanifest",
  "/robots.txt",
  "/rss.xml",
  "/sitemap.txt",
  "/sitemap.xml",
  "/skill.md",
]);

/** Whether a path belongs to a shared route that no school host rewrites. */
export function isSharedPath(pathname: string) {
  return (
    HashSet.has(SHARED_ROOT_FILES, pathname) ||
    Option.exists(Arr.get(pathname.split("/"), 1), (segment) =>
      HashSet.has(SHARED_FIRST_SEGMENTS, segment)
    )
  );
}

/** The label in front of one domain, when the host is exactly one school label under that domain. */
function readSchoolLabelUnder(
  hostname: string,
  domain: string
): Option.Option<TenantSlug> {
  const suffix = `.${domain}`;
  if (!hostname.endsWith(suffix)) {
    return Option.none();
  }
  const label = hostname.slice(0, -suffix.length);
  return label.includes(".")
    ? Option.none()
    : Option.filter(Option.some(label), isSchoolLabel);
}

/**
 * The school address that a host names, such as `harapan` for
 * `harapan.nakafa.com`. A host outside the school domains names no school, and
 * neither does a label that the slug rules refuse, such as a reserved one.
 */
export function readSchoolSlug(hostname: string): Option.Option<TenantSlug> {
  return Arr.findFirst(SCHOOL_DOMAINS, (domain) =>
    readSchoolLabelUnder(hostname, domain)
  );
}

/** The school domain that a host sits under, such as `nakafa.com` for `www.nakafa.com`, or none. */
function readHostDomain(hostname: string): Option.Option<string> {
  return Arr.findFirst(SCHOOL_DOMAINS, (domain) =>
    hostname === domain || hostname.endsWith(`.${domain}`)
      ? Option.some(domain)
      : Option.none()
  );
}

/** A copy of a URL with another path. The URL that the router passed in stays unchanged. */
function withPathname(url: URL, pathname: string) {
  const next = new URL(url);
  next.pathname = pathname;
  return next;
}

/**
 * Rewrites the second segment of a path that starts with a locale, such as
 * `/id/materi/x`. A path without a locale, or whose second segment the rewrite
 * does not know, keeps its spelling.
 */
function rewriteLocaleSegment(
  pathname: string,
  rewrite: (locale: Locale, segment: string) => Option.Option<string>
): string {
  const segments = pathname.split("/");
  const rewritten = Option.all([
    Option.flatMap(Arr.get(segments, 1), decodeLocale),
    Arr.get(segments, 2),
  ]).pipe(Option.flatMap(([locale, segment]) => rewrite(locale, segment)));
  return Option.match(rewritten, {
    onNone: () => pathname,
    onSome: (segment) =>
      Arr.join(
        [...Arr.take(segments, 2), segment, ...Arr.drop(segments, 3)],
        "/"
      ),
  });
}

/** The router's path of a public path: a localized second segment becomes its canonical name. */
export function toCanonicalPath(pathname: string): string {
  return rewriteLocaleSegment(pathname, (locale, spelling) =>
    Option.map(
      readCanonicalSpelling(locale, spelling),
      (canonical) => canonical
    )
  );
}

/** The public path of a router path: a canonical second segment becomes its spelling in the locale. */
export function toPublicPath(pathname: string): string {
  return rewriteLocaleSegment(pathname, (locale, name) =>
    Option.map(readCanonicalName(name), (canonical) =>
      publicSegment(canonical, locale)
    )
  );
}

/** Maps `/id/materi/x` to the router's `/id/materials/x`, and back in the output. */
export const localeRewrite = {
  input: ({ url }: { url: URL }) =>
    withPathname(url, toCanonicalPath(url.pathname)),
  output: ({ url }: { url: URL }) =>
    withPathname(url, toPublicPath(url.pathname)),
} satisfies RouteRewrite;

/**
 * Maps the school host `harapan.nakafa.com/exams` to the school tree at
 * `/school/harapan/exams`. Shared paths and reserved labels keep their own
 * route. The output maps the tree back to the school host of the domain that
 * the current host sits under, so a link to another school is a hard link.
 */
export const schoolRewrite = {
  input: ({ url }: { url: URL }) =>
    Option.match(readSchoolSlug(url.hostname), {
      onNone: () => url,
      onSome: (slug) =>
        isSharedPath(url.pathname)
          ? url
          : withPathname(
              url,
              `/${SCHOOL_SEGMENT}/${slug}${url.pathname === "/" ? "" : url.pathname}`
            ),
    }),
  output: ({ url }: { url: URL }) => {
    const parts = url.pathname.split("/");
    return Option.match(
      Option.all([readSchoolTreeSlug(parts), readHostDomain(url.hostname)]),
      {
        onNone: () => url,
        onSome: ([label, domain]) => {
          const next = new URL(url);
          next.hostname = `${label}.${domain}`;
          next.pathname = `/${Arr.join(Arr.drop(parts, 3), "/")}`;
          return next;
        },
      }
    );
  },
} satisfies RouteRewrite;

/**
 * The school address that a path of the school tree names, such as `harapan`
 * for `/school/harapan/exams`. The reserved start page of a main host, and a
 * label that is not a school address, name none.
 */
function readSchoolTreeSlug(
  parts: readonly string[]
): Option.Option<TenantSlug> {
  return Arr.get(parts, 1).pipe(
    Option.filter((tree) => tree === SCHOOL_SEGMENT),
    Option.flatMap(() => Arr.get(parts, 2)),
    Option.filter((label) => label !== SCHOOL_START_SEGMENT),
    Option.filter(isSchoolLabel)
  );
}
