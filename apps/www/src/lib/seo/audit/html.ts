import { Array as Arr, Option, Schema } from "effect";

/**
 * One crumb of a visible breadcrumb: the address it links, or none for a crumb that
 * names the page itself without a link.
 */
const VisibleCrumb = Schema.Struct({
  href: Schema.Option(Schema.String),
  label: Schema.String,
});

/** One `hreflang` alternate of a head, as its link names it. */
const PageAlternate = Schema.Struct({
  href: Schema.String,
  hreflang: Schema.String,
});

/**
 * What a crawler reads in one prerendered page: the head entries that decide its
 * search result, the JSON-LD texts, the number of `h1` headings, the labels of each
 * visible breadcrumb, the formulas whose MathML copy a snippet could still quote,
 * and how many bytes of the page a crawler reads before its main content ends.
 */
export const PageFacts = Schema.Struct({
  alternates: Schema.Array(PageAlternate),
  canonicals: Schema.Array(Schema.String),
  contentBytes: Schema.Int,
  descriptions: Schema.Array(Schema.String),
  headings: Schema.Int,
  jsonLd: Schema.Array(Schema.String),
  openMathCopies: Schema.Int,
  robots: Schema.Array(Schema.String),
  titles: Schema.Array(Schema.String),
  trails: Schema.Array(Schema.Array(VisibleCrumb)),
});

export type PageFacts = typeof PageFacts.Type;

/** The characters React escapes in text and attributes, by the entity it writes. */
const ENTITIES = [
  ["&lt;", "<"],
  ["&gt;", ">"],
  ["&quot;", '"'],
  ["&#x27;", "'"],
  ["&amp;", "&"],
] as const;

/** The text React wrote, with its entities read back; `&amp;` goes last, so `&amp;lt;` stays `&lt;`. */
function decodeText(text: string) {
  return Arr.reduce(ENTITIES, text, (decoded, [entity, character]) =>
    decoded.replaceAll(entity, character)
  );
}

/** One attribute of a start tag, its name and its value in double quotes. */
const ATTRIBUTE = /[^\s="/]+="[^"]*"/gu;

/** Every match of a pattern, as its whole text. */
function readMatches(text: string, pattern: RegExp) {
  return Arr.map(Arr.fromIterable(text.matchAll(pattern)), (found) => found[0]);
}

/** The attributes of one start tag, by name, with their values read back. */
function readAttributes(tag: string) {
  return Arr.map(readMatches(tag, ATTRIBUTE), (attribute) => {
    const equals = attribute.indexOf('="');
    return {
      name: attribute.slice(0, equals),
      value: decodeText(attribute.slice(equals + 2, -1)),
    };
  });
}

/** The value of one attribute of a start tag, or none. */
function readAttribute(tag: string, name: string) {
  return Option.map(
    Arr.findFirst(readAttributes(tag), (attribute) => attribute.name === name),
    (attribute) => attribute.value
  );
}

/** Every start tag of `name` in `html`, as its whole text. */
function readTags(html: string, name: string) {
  return readMatches(html, new RegExp(`<${name}\\b[^>]*>`, "gu"));
}

/** The text of an element's content: its tags and React's text markers dropped, its entities read back. */
function readText(content: string) {
  return decodeText(content.replaceAll(/<!--.*?-->|<[^>]*>/gsu, "")).trim();
}

/** The values of one attribute on every `tag` whose `key` attribute is `value`. */
function readKeyedValues(
  tags: readonly string[],
  key: string,
  value: string,
  attribute: string
) {
  return Arr.getSomes(
    Arr.map(tags, (tag) =>
      Option.exists(readAttribute(tag, key), (found) => found === value)
        ? readAttribute(tag, attribute)
        : Option.none()
    )
  );
}

const HEAD = /<head>.*?<\/head>/su;
const TITLE = /<title>.*?<\/title>/gsu;
const JSON_LD_START = '<script type="application/ld+json">';
const JSON_LD = /<script type="application\/ld\+json">.*?<\/script>/gsu;
const HEADING = /<h1[\s>]/gu;
const BREADCRUMB = /<nav\b[^>]*data-slot="breadcrumb"[^>]*>.*?<\/nav>/gsu;
const BREADCRUMB_CRUMB =
  /<a\b[^>]*data-slot="breadcrumb-link"[^>]*>.*?<\/a>|<span\b[^>]*data-slot="breadcrumb-page"[^>]*>.*?<\/span>/gsu;
const OPEN_MATH_COPY = /<span class="katex-mathml">/gu;
const MAIN_END = "</main>";

/**
 * The bytes of the page up to the end of its main content, as a crawler reads
 * them: UTF-8 and uncompressed. A page without a `<main>` counts whole.
 */
function readContentBytes(html: string) {
  const end = html.indexOf(MAIN_END);
  const content = end === -1 ? html : html.slice(0, end + MAIN_END.length);
  return new TextEncoder().encode(content).length;
}

/** How many times a pattern occurs in a text. */
function count(text: string, pattern: RegExp) {
  return readMatches(text, pattern).length;
}

/** One crumb of a visible breadcrumb: the link of its start tag, and its text. */
function readCrumb(element: string) {
  return {
    href: readAttribute(element.slice(0, element.indexOf(">") + 1), "href"),
    label: readText(element),
  };
}

/**
 * Reads the search facts of one page from the HTML that the build wrote. React and
 * the router write this markup, so each fact has one spelling: an attribute in
 * double quotes, one `<head>`, and JSON-LD in its own script.
 */
export function readPageFacts(html: string): PageFacts {
  const head = html.match(HEAD)?.[0] ?? "";
  const metas = readTags(head, "meta");
  const links = readTags(head, "link");
  return {
    alternates: Arr.getSomes(
      Arr.map(links, (tag) =>
        Option.exists(readAttribute(tag, "rel"), (rel) => rel === "alternate")
          ? Option.all({
              href: readAttribute(tag, "href"),
              hreflang: readAttribute(tag, "hreflang"),
            })
          : Option.none()
      )
    ),
    canonicals: readKeyedValues(links, "rel", "canonical", "href"),
    contentBytes: readContentBytes(html),
    descriptions: readKeyedValues(metas, "name", "description", "content"),
    headings: count(html, HEADING),
    jsonLd: Arr.map(readMatches(html, JSON_LD), (script) =>
      script.slice(JSON_LD_START.length, -"</script>".length)
    ),
    openMathCopies: count(html, OPEN_MATH_COPY),
    robots: readKeyedValues(metas, "name", "robots", "content"),
    titles: Arr.map(readMatches(head, TITLE), readText),
    trails: Arr.map(readMatches(html, BREADCRUMB), (nav) =>
      Arr.map(readMatches(nav, BREADCRUMB_CRUMB), readCrumb)
    ),
  };
}
