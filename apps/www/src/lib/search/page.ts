import type { Locale } from "@repo/internationalization/src/locale";
import { readCanonicalSpelling } from "@repo/internationalization/src/pathnames";
import { Array as Arr, Option, Order, Record as Rec, Schema } from "effect";
import type { SearchEntry, SearchKind } from "@/lib/search/entry";

/**
 * Reads the pages that the build prerendered into the entries of the search
 * index. Every public page already carries its place as structured data, a
 * schema.org `BreadcrumbList`, so the index reads exactly what the pages show,
 * in the reader's language, and costs the build no read of its own.
 */

/** One step of a page's breadcrumb: the name a reader sees and the page it opens. */
const Crumb = Schema.Struct({ item: Schema.String, name: Schema.String });

/** The breadcrumb that every public page publishes. */
const Breadcrumb = Schema.Struct({
  "@type": Schema.Literal("BreadcrumbList"),
  itemListElement: Schema.NonEmptyArray(Crumb),
});

/** A lesson's alignment with each curriculum that teaches it. */
const Lesson = Schema.Struct({
  "@type": Schema.Literal("LearningResource"),
  educationalAlignment: Schema.Array(
    Schema.Struct({ educationalFramework: Schema.String })
  ),
});

/** A surah's other name, its meaning in the reader's language, and its number. */
const Chapter = Schema.Struct({
  "@type": Schema.Literal("Chapter"),
  alternateName: Schema.String,
  position: Schema.Number,
});

/** The text of a structured data block: one node or a list of them. */
const StructuredData = Schema.fromJsonString(Schema.Unknown);

/** A structured data block of a page's HTML. */
const STRUCTURED_DATA =
  /<script type="application\/ld\+json"[^>]*>.*?<\/script>/gsu;

/** The tag that closes a structured data block. */
const CLOSING_TAG = "</script>";

/** Every structured data node of a page, a list flattened into its nodes. */
function readNodes(html: string): readonly unknown[] {
  return Arr.flatMap(
    Arr.fromIterable(html.matchAll(STRUCTURED_DATA)),
    (match) =>
      Option.match(
        Schema.decodeUnknownOption(StructuredData)(
          match[0].slice(match[0].indexOf(">") + 1, -CLOSING_TAG.length)
        ),
        {
          onNone: () => [],
          onSome: (node) => (Arr.isArray(node) ? node : [node]),
        }
      )
  );
}

/** The first node of a page that a schema reads. */
function findNode<Node>(
  nodes: readonly unknown[],
  schema: Schema.Codec<Node, unknown>
) {
  return Arr.findFirst(nodes, (node) =>
    Schema.decodeUnknownOption(schema)(node)
  );
}

/** The family a page belongs to by its first segment, which two families spell per locale. */
function readFamily(locale: Locale, segment: string) {
  return Option.getOrElse(
    readCanonicalSpelling(locale, segment),
    (): string => segment
  );
}

/** The kind of each depth of a family's pages, from its own first page down. */
const FAMILY_KINDS: Readonly<Record<string, readonly SearchKind[]>> = {
  articles: ["hub", "category", "article"],
  curricula: ["hub", "curriculum", "level", "subject"],
  materials: ["hub", "page", "page", "lesson"],
  quran: ["hub", "surah"],
  "try-out": ["hub", "country", "exam", "tryout", "tryout", "tryout"],
};

/** The kind of the page at a path: its family and how deep in it the page sits. */
export function classifyPath(locale: Locale, path: string): SearchKind {
  const [, , family = "", ...rest] = path.split("/");
  return Option.getOrElse(
    Option.flatMap(Rec.get(FAMILY_KINDS, readFamily(locale, family)), (kinds) =>
      Arr.get(kinds, rest.length)
    ),
    (): SearchKind => "page"
  );
}

/** The path of a crumb's page, without the site's origin. */
function crumbPath(crumb: typeof Crumb.Type) {
  return new URL(crumb.item).pathname;
}

/** Whether a crumb names a family's own first page, which the palette's group already names. */
function isHubCrumb(locale: Locale, crumb: typeof Crumb.Type) {
  const segments = crumbPath(crumb).split("/");
  return Option.exists(
    Arr.get(segments, 2),
    (family) =>
      segments.length === 3 && Rec.has(FAMILY_KINDS, readFamily(locale, family))
  );
}

/**
 * Reads the entry of one prerendered page, or none when the page publishes no
 * breadcrumb, as the home page and a try-out section, which its set stands for,
 * do. `flags` holds the country of each curriculum and try-out country by the
 * last segment of its path, its slug, which only those two kinds draw.
 */
export function readPageEntry({
  flags,
  html,
  locale,
  path,
}: {
  readonly flags: Readonly<Record<string, string>>;
  readonly html: string;
  readonly locale: Locale;
  readonly path: string;
}): Option.Option<SearchEntry> {
  const nodes = readNodes(html);
  return Option.map(findNode(nodes, Breadcrumb), ({ itemListElement }) => {
    const crumbs = Arr.drop(Arr.dropRight(itemListElement, 1), 1);
    const title = Arr.lastNonEmpty(itemListElement).name;
    const trail = Arr.map(
      Arr.filter(crumbs, (crumb) => !isHubCrumb(locale, crumb)),
      ({ name }) => name
    );
    const terms = Arr.dedupe(
      Arr.filter(
        [
          ...Option.match(findNode(nodes, Lesson), {
            onNone: () => [],
            onSome: ({ educationalAlignment }) =>
              Arr.map(educationalAlignment, (row) => row.educationalFramework),
          }),
          ...Option.match(findNode(nodes, Chapter), {
            onNone: () => [],
            onSome: (chapter) => [chapter.alternateName, `${chapter.position}`],
          }),
        ],
        (term) => term !== title && !Arr.contains(trail, term)
      )
    );
    const kind = classifyPath(locale, path);
    const flag = Option.flatMap(
      Option.liftPredicate(
        kind,
        (own) => own === "curriculum" || own === "country"
      ),
      () =>
        Option.flatMap(Arr.last(path.split("/")), (slug) =>
          Rec.get(flags, slug)
        )
    );
    return {
      ...(Option.isSome(flag) ? { flag: flag.value } : {}),
      kind,
      path,
      ...(terms.length > 0 ? { terms } : {}),
      title,
      trail,
    };
  });
}

/** The segments of an exam's address: `/<locale>/try-out/<country>/<exam>`. */
const EXAM_SEGMENTS = 5;

/** Orders pages from the shallowest, then by address, so the first page under an exam leads. */
const ShallowFirst = Order.combineAll<SearchEntry>([
  Order.mapInput(Order.Number, ({ path }) => path.split("/").length),
  Order.mapInput(Order.String, ({ path }) => path),
]);

/**
 * The exams of the try-outs. An exam's own address redirects to its first page,
 * so the build writes no page for it, and its name is the second step of the
 * trail of every try-out page under it. Its entry opens that first page, the
 * shallowest under the exam, as the redirect does.
 */
export function readExamEntries(
  entries: readonly SearchEntry[]
): readonly SearchEntry[] {
  const byExam = Arr.groupBy(
    Arr.filter(
      entries,
      ({ kind, trail }) => kind === "tryout" && trail.length >= 2
    ),
    ({ path }) => Arr.join(Arr.take(path.split("/"), EXAM_SEGMENTS), "/")
  );
  return Arr.getSomes(
    Arr.map(Rec.toEntries(byExam), ([exam, pages]) => {
      const first = Arr.min(pages, ShallowFirst);
      return Option.map(
        Option.liftPredicate(first, () =>
          Arr.every(entries, ({ path }) => path !== exam)
        ),
        (page) => ({
          kind: "exam" as const,
          path: page.path,
          title: Arr.join(Arr.take(Arr.drop(page.trail, 1), 1), ""),
          trail: Arr.take(page.trail, 1),
        })
      );
    })
  );
}
