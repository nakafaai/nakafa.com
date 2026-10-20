import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import {
  decodeLocale,
  type Locale,
} from "@repo/internationalization/src/locale";
import { Data, Option, Schema } from "effect";

/** Stable identity for the sitemap containing application-level routes. */
export const SITEMAP_BASE_ID = "base";

const SitemapBasePageSchema = Schema.Struct({
  id: Schema.Literal(SITEMAP_BASE_ID),
});

const SitemapFamilyPageFields = {
  id: Schema.String,
  locale: ActiveAppLocaleCodeSchema,
  partition: Schema.Finite,
};

const ArticleSitemapPageSchema = Schema.Struct({
  ...SitemapFamilyPageFields,
  kind: Schema.Literal("article"),
});

const MaterialSitemapPageSchema = Schema.Struct({
  ...SitemapFamilyPageFields,
  kind: Schema.Literal("material"),
});

const ProgramSitemapPageSchema = Schema.Struct({
  ...SitemapFamilyPageFields,
  kind: Schema.Literal("program"),
});

const SitemapFamilyPageSchema = Schema.Union([
  ArticleSitemapPageSchema,
  MaterialSitemapPageSchema,
  ProgramSitemapPageSchema,
]);

/** Article, material, and curriculum pages sharing one partition seam. */
export type SitemapFamilyPage = typeof SitemapFamilyPageSchema.Type;

const PageSitemapPageSchema = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literal("page"),
  locale: ActiveAppLocaleCodeSchema,
});

const QuranSitemapPageSchema = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literal("quran"),
  locale: ActiveAppLocaleCodeSchema,
});

const TryoutSitemapPageSchema = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literal("tryout"),
  locale: ActiveAppLocaleCodeSchema,
  page: Schema.Finite,
});

const SitemapPageSchema = Schema.Union([
  SitemapBasePageSchema,
  SitemapFamilyPageSchema,
  PageSitemapPageSchema,
  QuranSitemapPageSchema,
  TryoutSitemapPageSchema,
]);

/** One canonical sitemap XML page identity. */
export type SitemapPage = typeof SitemapPageSchema.Type;

/** A canonical sitemap page id whose route page does not exist. */
export class SitemapPageNotFoundError extends Data.TaggedError(
  "SitemapPageNotFoundError"
)<{
  readonly pageId: string;
}> {}

/** Content families served through capacity-owned sitemap partitions. */
const SitemapFamilySchema = Schema.Literals(["article", "material", "program"]);
export type SitemapFamily = typeof SitemapFamilySchema.Type;

/** Prefix marking one capacity-owned sitemap partition index. */
const PARTITION_PREFIX = "p";

/** Formats one capacity-owned published-article sitemap partition id. */
export function formatArticlePartition(locale: Locale, partition: number) {
  return `article_${locale}_${PARTITION_PREFIX}${partition}`;
}

/** Formats one capacity-owned published-material sitemap partition id. */
export function formatMaterialPartition(locale: Locale, partition: number) {
  return `material_${locale}_${PARTITION_PREFIX}${partition}`;
}

/** Formats one capacity-owned published-program sitemap partition id. */
export function formatProgramPartition(locale: Locale, partition: number) {
  return `program_${locale}_${PARTITION_PREFIX}${partition}`;
}

/** Formats the complete signed Page sitemap identity for one locale. */
export function formatPagePage(locale: Locale) {
  return `page_${locale}`;
}

/** Formats the bounded signed Quran sitemap page id. */
export function formatQuranPage(locale: Locale) {
  return `quran_${locale}`;
}

/** Formats one bounded signed try-out sitemap page id. */
export function formatTryoutPage(locale: Locale, page: number) {
  return `tryout_${locale}_${page}`;
}

/** Parses one canonical sitemap page identity, or none when no page has that id. */
export function getSitemapPageDescriptor(
  id: string
): Option.Option<SitemapPage> {
  if (id === SITEMAP_BASE_ID) {
    return Option.some({ id: SITEMAP_BASE_ID });
  }

  const segments = id.split("_");
  const [prefix, rawLocale] = segments;
  const decodedLocale = decodeLocale(rawLocale);
  if (Option.isNone(decodedLocale)) {
    return Option.none();
  }
  const locale = decodedLocale.value;

  if (prefix === "quran" || prefix === "page") {
    return segments.length === 2
      ? Option.some({ id, kind: prefix, locale })
      : Option.none();
  }

  if (segments.length !== 3) {
    return Option.none();
  }
  if (prefix === "tryout") {
    return Option.map(parsePageNumber(segments[2]), (page) => ({
      id,
      kind: prefix,
      locale,
      page,
    }));
  }

  if (!Schema.is(SitemapFamilySchema)(prefix)) {
    return Option.none();
  }
  return describePartitionSitemapPage(prefix, id, locale, segments[2]);
}

/** Describes one capacity-owned family sitemap partition page. */
function describePartitionSitemapPage(
  kind: SitemapFamily,
  id: string,
  locale: Locale,
  segment: string | undefined
): Option.Option<SitemapPage> {
  return Option.map(parsePartitionNumber(segment), (partition) => ({
    id,
    kind,
    locale,
    partition,
  }));
}

/** Checks whether one page targets published article rows. */
export function isArticleSitemapPage(
  page: SitemapPage
): page is typeof ArticleSitemapPageSchema.Type {
  return "kind" in page && page.kind === "article";
}

/** Checks whether one page targets published material rows. */
export function isMaterialSitemapPage(
  page: SitemapPage
): page is typeof MaterialSitemapPageSchema.Type {
  return "kind" in page && page.kind === "material";
}

/** Checks whether one page targets published curriculum rows. */
export function isProgramSitemapPage(
  page: SitemapPage
): page is typeof ProgramSitemapPageSchema.Type {
  return "kind" in page && page.kind === "program";
}

/** Checks whether one sitemap page targets signed public Pages. */
export function isPageSitemapPage(
  page: SitemapPage
): page is typeof PageSitemapPageSchema.Type {
  return "kind" in page && page.kind === "page";
}

/** Checks whether one page targets the signed Quran catalog. */
export function isQuranSitemapPage(
  page: SitemapPage
): page is typeof QuranSitemapPageSchema.Type {
  return "kind" in page && page.kind === "quran";
}

/** Checks whether one page targets signed try-out routes. */
export function isTryoutSitemapPage(
  page: SitemapPage
): page is typeof TryoutSitemapPageSchema.Type {
  return "kind" in page && page.kind === "tryout";
}

/** Parses one canonical non-negative sitemap page number. */
function parsePageNumber(segment: string | undefined): Option.Option<number> {
  if (!segment) {
    return Option.none();
  }
  const page = Number(segment);
  if (!Number.isSafeInteger(page) || page < 0 || String(page) !== segment) {
    return Option.none();
  }
  return Option.some(page);
}

/** Parses one canonical capacity-owned partition suffix such as `p0`. */
function parsePartitionNumber(
  segment: string | undefined
): Option.Option<number> {
  if (!segment?.startsWith(PARTITION_PREFIX)) {
    return Option.none();
  }
  return parsePageNumber(segment.slice(PARTITION_PREFIX.length));
}
