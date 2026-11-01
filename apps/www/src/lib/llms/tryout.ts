import type { Ref } from "@confect/core";
import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { readServerTranslator } from "@repo/internationalization/src/translator";
import {
  Array as Arr,
  Effect,
  Match,
  Option,
  String as Str,
  Stream,
} from "effect";
import type { Locale } from "use-intl";
import {
  readTryoutCountryPage,
  readTryoutExamPage,
  readTryoutHubPage,
  readTryoutSetList,
  readTryoutSetPage,
  readTryoutTrackPage,
} from "@/components/tryout/catalog/source.server";
import { CATALOG_QUERY_DEFAULTS } from "@/components/tryout/catalog/table/query";
import { TRYOUT_SET_PAGE_SIZE } from "@/components/tryout/catalog/table/types";
import { BASE_URL } from "@/lib/llms/constants";
import { buildHeader } from "@/lib/llms/format";

/** The try-out family segment, which every locale spells the same way. */
const TRYOUT_SEGMENT = "try-out";

/** What the catalog says of any of its pages. */
type CatalogPage = Pick<
  NonNullable<Ref.Returns<typeof tryouts.queries.catalog.getExamPage>>["exam"],
  "description" | "publicPath" | "title"
>;

/** The arguments of one track's set list, without the window they ask for. */
type TrackSets = Omit<
  Ref.Args<typeof tryouts.queries.sets.list>,
  "paginationOpts"
>;

/** The words of the try-out pages in one locale. */
const readWords = (locale: Locale) =>
  Effect.promise(() => readServerTranslator({ locale, namespace: "Tryouts" }));

/** One catalog page as a line of its parent's list. */
function catalogLine(locale: Locale, page: CatalogPage) {
  const link = `[${page.title}](${BASE_URL}/${locale}/${page.publicPath})`;
  return page.description === undefined
    ? `- ${link}`
    : `- ${link}: ${page.description}`;
}

/** The Markdown of one catalog page: its header, then what it lists. */
function catalogText(
  locale: Locale,
  page: Required<CatalogPage>,
  lines: readonly string[]
) {
  return Arr.join(
    [
      ...buildHeader({
        description: page.description,
        title: page.title,
        url: `${BASE_URL}/${locale}/${page.publicPath}`,
      }),
      ...lines,
      "",
    ],
    "\n"
  );
}

/** Reads every set of a track, a window at a time, as a visitor sees them. */
const readTrackSets = (args: TrackSets) =>
  Stream.runCollect(
    Stream.paginate(null, (cursor: string | null) =>
      Effect.map(
        readTryoutSetList(Option.none(), {
          ...args,
          paginationOpts: { cursor, numItems: TRYOUT_SET_PAGE_SIZE },
        }),
        ({ continueCursor, isDone, page }) =>
          [page, isDone ? Option.none() : Option.some(continueCursor)] as const
      )
    )
  );

const readHubText = Effect.fn("www.llms.tryout.hub")(function* (
  locale: Locale
) {
  const [hub, tTryouts, tCommon] = yield* Effect.all(
    [
      readTryoutHubPage(locale),
      readWords(locale),
      Effect.promise(() =>
        readServerTranslator({ locale, namespace: "Common" })
      ),
    ],
    { concurrency: "unbounded" }
  );
  return catalogText(
    locale,
    {
      description: tTryouts("metadata-description"),
      publicPath: TRYOUT_SEGMENT,
      title: tCommon("try-out"),
    },
    Arr.map(hub.countries, (country) => catalogLine(locale, country))
  );
});

const readCountryText = Effect.fn("www.llms.tryout.country")(function* (
  locale: Locale,
  publicPath: string
) {
  const [page, tTryouts] = yield* Effect.all(
    [readTryoutCountryPage(locale, publicPath), readWords(locale)],
    { concurrency: "unbounded" }
  );
  if (Option.isNone(page)) {
    return null;
  }
  const { country, exams } = page.value;
  return catalogText(
    locale,
    {
      description: country.description ?? tTryouts("metadata-description"),
      publicPath: country.publicPath,
      title: country.title,
    },
    Arr.map(exams, (exam) => catalogLine(locale, exam))
  );
});

const readExamText = Effect.fn("www.llms.tryout.exam")(function* (
  locale: Locale,
  publicPath: string
) {
  const [page, tTryouts] = yield* Effect.all(
    [readTryoutExamPage(locale, publicPath), readWords(locale)],
    { concurrency: "unbounded" }
  );
  if (!page) {
    return null;
  }
  return catalogText(
    locale,
    {
      description: page.exam.description ?? tTryouts("metadata-description"),
      publicPath: page.exam.publicPath,
      title: page.exam.title,
    },
    Arr.map(page.tracks, (track) => catalogLine(locale, track))
  );
});

const readTrackText = Effect.fn("www.llms.tryout.track")(function* (
  locale: Locale,
  publicPath: string
) {
  const [page, tTryouts] = yield* Effect.all(
    [readTryoutTrackPage(locale, publicPath), readWords(locale)],
    { concurrency: "unbounded" }
  );
  if (!page) {
    return null;
  }
  const sets = yield* readTrackSets({
    countryKey: page.country.countryKey,
    examKey: page.exam.examKey,
    filter: CATALOG_QUERY_DEFAULTS.status,
    locale,
    sort: {
      direction: CATALOG_QUERY_DEFAULTS.direction,
      field: CATALOG_QUERY_DEFAULTS.sort,
    },
    trackKey: page.track.trackKey,
  });
  const exam = `${page.exam.title} ${page.track.title}`;
  return catalogText(
    locale,
    {
      description:
        page.track.description ??
        tTryouts("track-metadata-description", { exam }),
      publicPath: page.track.publicPath,
      title: exam,
    },
    Arr.map(sets, (set) => catalogLine(locale, set))
  );
});

const readSetText = Effect.fn("www.llms.tryout.set")(function* (
  locale: Locale,
  publicPath: string
) {
  const [page, tTryouts] = yield* Effect.all(
    [readTryoutSetPage(locale, publicPath), readWords(locale)],
    { concurrency: "unbounded" }
  );
  if (!page) {
    return null;
  }
  const exam = `${page.exam.title} ${page.track.title}`;
  return catalogText(
    locale,
    {
      description:
        page.set.description ??
        tTryouts("set-metadata-description", { exam, set: page.set.title }),
      publicPath: page.set.publicPath,
      title: `${exam} ${page.set.title}`,
    },
    Arr.map(page.sections, (section) => {
      const minutes = tTryouts("set-duration-minutes", {
        minutes: section.timeLimitSeconds / 60,
      });
      return `- ${section.title}: ${section.questionCount} ${tTryouts("part-questions-label")}, ${minutes}`;
    })
  );
});

/**
 * Renders a try-out catalog page as agent-readable Markdown: the hub, a country, an
 * exam, a track or a set. A section page has none, because its set stands for it, so
 * a null result means the route has no try-out source.
 */
export const getTryoutLlmsText = Effect.fn("www.llms.tryout.text")(function* ({
  cleanSlug,
  locale,
}: {
  cleanSlug: string;
  locale: Locale;
}) {
  const segments = Str.split(cleanSlug, "/");
  if (Arr.headNonEmpty(segments) !== TRYOUT_SEGMENT) {
    return null;
  }
  return yield* Match.value(Arr.length(segments)).pipe(
    Match.when(1, () => readHubText(locale)),
    Match.when(2, () => readCountryText(locale, cleanSlug)),
    Match.when(3, () => readExamText(locale, cleanSlug)),
    Match.when(4, () => readTrackText(locale, cleanSlug)),
    Match.when(5, () => readSetText(locale, cleanSlug)),
    Match.orElse(() => Effect.succeed(null))
  );
});
