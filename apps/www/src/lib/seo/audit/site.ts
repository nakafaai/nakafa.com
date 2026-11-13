import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr, HashMap, Option, Record as Rec, Schema } from "effect";
// The Vite config imports this module, and only package imports resolve there.
import { PageFacts } from "#www/src/lib/seo/audit/html";
import {
  auditPage,
  isIndexable,
  type PageAudit,
} from "#www/src/lib/seo/audit/page";

/** One page that the build wrote, by its path, with what a crawler reads in it. */
export const BuiltPage = Schema.Struct({
  facts: PageFacts,
  path: Schema.String,
});

type BuiltPage = typeof BuiltPage.Type;

/** The locale of a page, its first path segment. */
function readLocale(path: string) {
  return Arr.join(Arr.take(Arr.drop(path.split("/"), 1), 1), "");
}

/** The problems of a value that two pages of one locale share, such as a title. */
function checkUnique(
  label: string,
  audits: readonly (readonly [string, PageAudit])[],
  read: (audit: PageAudit) => string
) {
  const groups = Arr.groupBy(
    audits,
    ([path, audit]) => `${readLocale(path)} ${read(audit)}`
  );
  return Arr.flatMap(Rec.values(groups), (members) => {
    const [[, first]] = members;
    const paths = Arr.join(
      Arr.map(members, ([path]) => path),
      ", "
    );
    return members.length > 1
      ? [`${paths}: these pages share the ${label} "${read(first)}"`]
      : [];
  });
}

/** The path of an address on the site's origin, or none for any other address. */
function toSitePath(href: string) {
  return href.startsWith(`${SITE_ORIGIN}/`)
    ? Option.some(new URL(href).pathname)
    : Option.none();
}

/**
 * The problems of the links between pages: an alternate must answer with an
 * indexable page that names this page back, and a crumb must lead to an
 * indexable page.
 */
function checkLinks(
  audits: readonly (readonly [string, PageAudit])[],
  byPath: HashMap.HashMap<string, PageAudit>
) {
  return Arr.flatMap(audits, ([path, audit]) => [
    ...Arr.flatMap(audit.alternates, (href) => {
      const target = Option.flatMap(toSitePath(href), (other) =>
        HashMap.get(byPath, other)
      );
      if (Option.isNone(target)) {
        return [`${path}: the alternate ${href} is no indexable page`];
      }
      return Arr.contains(target.value.alternates, audit.canonical)
        ? []
        : [`${path}: the alternate ${href} does not name the page back`];
    }),
    ...Arr.flatMap(audit.crumbs, (href) =>
      Option.isSome(
        Option.flatMap(toSitePath(href), (other) => HashMap.get(byPath, other))
      )
        ? []
        : [`${path}: the crumb ${href} is no indexable page`]
    ),
  ]);
}

/**
 * Checks every page that the build wrote against the search contract. A page in
 * the sitemap must be indexable; every indexable page must pass `auditPage`; no two
 * pages of a locale share a title or a description; and alternates and crumbs lead
 * to indexable pages, each alternate naming its page back. A page that is not
 * indexable, such as a try-out section, is left to its robots rule.
 */
export function auditSite(
  pages: readonly BuiltPage[],
  sitemapPaths: readonly string[]
) {
  const indexable = Arr.filter(pages, (page) => isIndexable(page.facts));
  const audits = Arr.map(
    indexable,
    (page) => [page.path, auditPage(page.path, page.facts)] as const
  );
  const byPath = HashMap.fromIterable(audits);
  return [
    ...Arr.map(
      Arr.filter(sitemapPaths, (path) => !HashMap.has(byPath, path)),
      (path) =>
        `${path}: the sitemap lists a page the build did not write as indexable`
    ),
    ...Arr.flatMap(audits, ([, audit]) => audit.problems),
    ...checkUnique("title", audits, (audit) => audit.title),
    ...checkUnique("description", audits, (audit) => audit.description),
    ...checkLinks(audits, byPath),
  ];
}
