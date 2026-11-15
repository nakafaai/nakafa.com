import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr, Option, Schema } from "effect";
// The Vite config imports this module, and only package imports resolve there.
import type { PageFacts } from "#www/src/lib/seo/audit/html";

/** One crumb of a BreadcrumbList as Google reads it: its place, its name and its page. */
const ListItem = Schema.Struct({
  "@type": Schema.Literal("ListItem"),
  item: Schema.String,
  name: Schema.Trimmed.check(Schema.isNonEmpty()),
  position: Schema.Int,
});

/** A BreadcrumbList node, whose crumbs run from the site root to the page. */
const BreadcrumbNode = Schema.Struct({
  "@type": Schema.Literal("BreadcrumbList"),
  itemListElement: Schema.Array(ListItem),
});

/** Any node that names its type, which selects the breadcrumb among a page's nodes. */
const TypedNode = Schema.Struct({ "@type": Schema.String });

const isBreadcrumbClaim = Schema.is(
  Schema.Struct({ "@type": Schema.Literal("BreadcrumbList") })
);
const isTypedNode = Schema.is(TypedNode);
const decodeJson = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.Unknown)
);
const decodeBreadcrumb = Schema.decodeUnknownOption(BreadcrumbNode);
const isNodeList = Schema.is(Schema.Array(Schema.Unknown));

/**
 * What one indexable page says about itself, for the checks that compare pages:
 * its title, description and alternates, and the pages its breadcrumb names.
 */
export const PageAudit = Schema.Struct({
  alternates: Schema.Array(Schema.String),
  canonical: Schema.String,
  crumbs: Schema.Array(Schema.String),
  description: Schema.String,
  problems: Schema.Array(Schema.String),
  title: Schema.String,
});

export type PageAudit = typeof PageAudit.Type;

/**
 * The bytes of a page that Googlebot fetches for Search, uncompressed: it stops
 * there and indexes only what it read, so a page's main content must end before.
 *
 * @see https://developers.google.com/search/docs/crawling-indexing/googlebot
 */
const GOOGLEBOT_FETCH_BYTES = 2_000_000;

/** Whether a page lets search engines index it, as its robots meta says. */
export function isIndexable(facts: PageFacts) {
  return Arr.some(facts.robots, (robots) => robots.startsWith("index"));
}

/** Whether `wanted` appear in `names` in the same order, each after the one before. */
function isOrderedWithin(wanted: readonly string[], names: readonly string[]) {
  return Option.isSome(
    Arr.reduce(wanted, Option.some(0), (from, label) =>
      Option.flatMap(from, (start) =>
        Option.map(
          Arr.findFirstIndex(Arr.drop(names, start), (name) => name === label),
          (index) => start + index + 1
        )
      )
    )
  );
}

/** The nodes of every JSON-LD script, a document holding one node or a list of them. */
function readNodes(jsonLd: readonly string[]) {
  return Arr.map(jsonLd, (text) =>
    Option.map(decodeJson(text), (document) =>
      isNodeList(document) ? document : [document]
    )
  );
}

/** The problems of one breadcrumb, which must count from 1 and end at the page on the site's origin. */
function checkCrumbs(
  items: readonly (typeof ListItem.Type)[],
  canonical: string
) {
  return [
    ...(items.length < 2 ? ["the breadcrumb has fewer than two crumbs"] : []),
    ...(Arr.every(items, (item, index) => item.position === index + 1)
      ? []
      : ["the breadcrumb does not count its crumbs from 1"]),
    ...Arr.map(
      Arr.filter(items, (item) => !item.item.startsWith(`${SITE_ORIGIN}/`)),
      (item) => `the crumb ${item.name} leaves the site: ${item.item}`
    ),
    ...(Option.exists(Arr.last(items), (item) => item.item === canonical)
      ? []
      : ["the breadcrumb does not end at the page"]),
  ];
}

/** The path of an address on the site's origin, without the section it points into, or none. */
function toPagePath(href: string) {
  const url = new URL(href, SITE_ORIGIN);
  return url.origin === SITE_ORIGIN ? Option.some(url.pathname) : Option.none();
}

/**
 * The pages a visible breadcrumb leads through after its root, in order. A crumb that
 * links a section of a page, such as a lesson's topic on its subject page, counts as
 * that page, a crumb without a link is the page itself, and a link off the site
 * stays its address, which no trail names. The root is left out: a
 * reader's Home is the learner's home, and a crawler's is the locale's root.
 */
function readVisiblePages(trail: PageFacts["trails"][number], path: string) {
  return Arr.dedupeAdjacent(
    Arr.map(Arr.drop(trail, 1), (crumb) =>
      Option.match(crumb.href, {
        onNone: () => path,
        onSome: (href) => Option.getOrElse(toPagePath(href), () => href),
      })
    )
  );
}

/** The pages a structured breadcrumb leads through after its root, in order. */
function readStructuredPages(items: readonly (typeof ListItem.Type)[]) {
  return Arr.getSomes(
    Arr.map(Arr.drop(items, 1), (item) => toPagePath(item.item))
  );
}

/**
 * The problems of the page's structured data, and the crumbs its breadcrumbs name.
 * A page reached through several paths, such as a lesson that several curricula
 * place, names one BreadcrumbList for each, as Google reads several trails.
 */
function checkStructuredData(
  path: string,
  facts: PageFacts,
  canonical: string
) {
  const documents = readNodes(facts.jsonLd);
  const nodes = Arr.flatten(Arr.getSomes(documents));
  const claims = Arr.filter(nodes, (node) => isBreadcrumbClaim(node));
  const trails = Arr.map(
    Arr.getSomes(Arr.map(claims, (claim) => decodeBreadcrumb(claim))),
    (node) => node.itemListElement
  );
  const structured = Arr.map(trails, readStructuredPages);
  // The root of a locale is where every breadcrumb starts, so it names none.
  const isRoot =
    Arr.filter(path.split("/"), (part) => part !== "").length === 1;
  return {
    crumbs: Arr.flatMap(trails, (items) =>
      Arr.map(Arr.dropRight(items, 1), (item) => item.item)
    ),
    problems: [
      ...Arr.map(
        Arr.filter(documents, Option.isNone),
        () => "a JSON-LD script is no JSON"
      ),
      ...Arr.map(
        Arr.filter(nodes, (node) => !isTypedNode(node)),
        () => "a JSON-LD node names no @type"
      ),
      ...(isRoot || claims.length > 0 ? [] : ["no BreadcrumbList"]),
      ...(trails.length === claims.length
        ? []
        : ["a BreadcrumbList is not a list of named, placed crumbs"]),
      ...Arr.flatMap(trails, (items) => checkCrumbs(items, canonical)),
      ...Arr.map(
        Arr.filter(facts.trails, (trail) => {
          const pages = readVisiblePages(trail, path);
          return (
            structured.length > 0 &&
            !Arr.some(structured, (names) => isOrderedWithin(pages, names))
          );
        }),
        (trail) =>
          `the visible breadcrumb ${Arr.join(
            Arr.map(trail, (crumb) => crumb.label),
            " > "
          )} leads through pages that no BreadcrumbList names`
      ),
    ],
  };
}

/** The problems of a head entry that a page must name exactly once and never leave empty. */
function checkOne(label: string, values: readonly string[]) {
  if (values.length !== 1) {
    return [`${values.length} ${label} entries, needs 1`];
  }
  return Arr.some(values, (value) => value.trim() === "")
    ? [`the ${label} is empty`]
    : [];
}

/**
 * Checks one indexable page against the search contract: one title, description,
 * robots rule and canonical link to its own address, a self and an `x-default`
 * alternate on the site's origin, one `h1`, JSON-LD that parses, one breadcrumb that
 * ends at the page and agrees with the breadcrumb a reader sees, main content that
 * ends inside the bytes Googlebot fetches, and no formula whose MathML copy a
 * snippet could quote.
 */
export function auditPage(path: string, facts: PageFacts): PageAudit {
  const canonical = new URL(path, SITE_ORIGIN).href;
  const hrefs = Arr.map(facts.alternates, (alternate) => alternate.href);
  const languages = Arr.map(
    facts.alternates,
    (alternate) => alternate.hreflang
  );
  const data = checkStructuredData(path, facts, canonical);
  const problems = [
    ...checkOne("title", facts.titles),
    ...checkOne("description", facts.descriptions),
    ...checkOne("robots", facts.robots),
    ...checkOne("canonical", facts.canonicals),
    ...(Arr.every(facts.canonicals, (href) => href === canonical)
      ? []
      : [`the canonical link is not ${canonical}`]),
    ...(Arr.contains(hrefs, canonical) ? [] : ["no alternate names the page"]),
    ...(Arr.contains(languages, "x-default") ? [] : ["no x-default alternate"]),
    ...(Arr.dedupe(languages).length === languages.length
      ? []
      : ["an hreflang repeats"]),
    ...Arr.map(
      Arr.filter(hrefs, (href) => !href.startsWith(`${SITE_ORIGIN}/`)),
      (href) => `the alternate ${href} leaves the site`
    ),
    ...(facts.headings === 1 ? [] : [`${facts.headings} h1 headings, needs 1`]),
    ...(facts.contentBytes <= GOOGLEBOT_FETCH_BYTES
      ? []
      : [
          `the main content ends at byte ${facts.contentBytes}, past the ${GOOGLEBOT_FETCH_BYTES} that Googlebot fetches`,
        ]),
    ...(facts.openMathCopies === 0
      ? []
      : [
          `${facts.openMathCopies} formulas open their MathML copy to snippets`,
        ]),
    ...data.problems,
  ];
  return {
    alternates: Arr.map(
      Arr.filter(
        facts.alternates,
        (alternate) => alternate.hreflang !== "x-default"
      ),
      (alternate) => alternate.href
    ),
    canonical,
    crumbs: data.crumbs,
    description: Option.getOrElse(Arr.head(facts.descriptions), () => ""),
    problems: Arr.map(problems, (problem) => `${path}: ${problem}`),
    title: Option.getOrElse(Arr.head(facts.titles), () => ""),
  };
}
