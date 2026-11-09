import {
  AlarmClockIcon,
  Archive01Icon,
  Backpack01Icon,
  Book02Icon,
  Book03Icon,
  Book04Icon,
  BookBookmark01Icon,
  BookEditIcon,
  BookOpen01Icon,
  BookOpen02Icon,
  Books01Icon,
  Books02Icon,
  CheckListIcon,
  CheckmarkSquare01Icon,
  Clock01Icon,
  CodeIcon,
  Compass01Icon,
  EarthIcon,
  File01Icon,
  File02Icon,
  FileEditIcon,
  Folder01Icon,
  Folder02Icon,
  Globe02Icon,
  InformationCircleIcon,
  LanternIcon,
  Layers01Icon,
  LegalDocument01Icon,
  LibraryIcon,
  MapsIcon,
  Money01Icon,
  Moon02Icon,
  Mortarboard01Icon,
  Mortarboard02Icon,
  MosqueIcon,
  News01Icon,
  NewsIcon,
  Note01Icon,
  Note02Icon,
  Notebook01Icon,
  Notebook02Icon,
  Quran01Icon,
  Quran02Icon,
  Quran03Icon,
  QuranIcon,
  Route01Icon,
  School01Icon,
  SchoolIcon,
  Search02Icon,
  Shield01Icon,
  Target02Icon,
  TasbihIcon,
  Task01Icon,
  TaskDone01Icon,
  Timer01Icon,
  Timer02Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { getTileLooks } from "@repo/design-system/lib/look";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { useLocation } from "@tanstack/react-router";
import {
  Array as Arr,
  type Effect,
  Option,
  Predicate,
  Result,
  Schema,
} from "effect";
import { useLocale, useTranslations } from "use-intl";
import { CountryFlagIcon } from "@/components/shared/flag";
import { SearchEntry, type SearchKind } from "@/lib/search/entry";
import {
  groupHits,
  readExploreEntries,
  readNearEntries,
  type SearchGroup,
} from "@/lib/search/group";
import type {
  readSearchIndex,
  SearchIndexUnavailable,
} from "@/lib/search/load";
import { markTitle, searchEntries, TitlePart } from "@/lib/search/rank";

/**
 * The icons each kind draws from, best known first. Every icon of a pool means
 * the same kind of page, and a list hands its rows different icons of their
 * pools (`getTileLooks`), so no two rows of a group look alike. A curriculum
 * and a try-out country draw their flag instead.
 */
const KIND_ICONS: Readonly<
  Record<SearchKind, Arr.NonEmptyReadonlyArray<IconSvgElement>>
> = {
  article: [News01Icon, NewsIcon, File02Icon, FileEditIcon],
  category: [Folder01Icon, Folder02Icon, Archive01Icon],
  country: [Globe02Icon, EarthIcon, MapsIcon],
  curriculum: [EarthIcon, Globe02Icon, MapsIcon],
  exam: [Task01Icon, TaskDone01Icon, CheckListIcon, CheckmarkSquare01Icon],
  hub: [Compass01Icon, Route01Icon, Target02Icon, Layers01Icon],
  lesson: [
    BookOpen01Icon,
    BookOpen02Icon,
    Book02Icon,
    Book03Icon,
    Notebook01Icon,
    Notebook02Icon,
    Note01Icon,
    Note02Icon,
    BookEditIcon,
  ],
  level: [
    School01Icon,
    SchoolIcon,
    Mortarboard01Icon,
    Mortarboard02Icon,
    Backpack01Icon,
  ],
  page: [
    File01Icon,
    LegalDocument01Icon,
    Shield01Icon,
    InformationCircleIcon,
    Money01Icon,
    CodeIcon,
  ],
  subject: [
    LibraryIcon,
    Books01Icon,
    Books02Icon,
    BookBookmark01Icon,
    Book04Icon,
  ],
  surah: [
    QuranIcon,
    Quran01Icon,
    Quran02Icon,
    Quran03Icon,
    MosqueIcon,
    Moon02Icon,
    LanternIcon,
    TasbihIcon,
  ],
  tryout: [Timer01Icon, Timer02Icon, Clock01Icon, AlarmClockIcon],
};

/** An icon of the Hugeicons set, which a row draws when it has no flag. */
const RowIcon = Schema.declare((input: unknown): input is IconSvgElement =>
  Arr.isArray(input)
);

/**
 * One row of the palette: the page it opens, its flag (a country code) or icon,
 * its title with the matched words, and the pages above it. `go` leads to a page
 * of the index by its address, or to the search page with the query.
 */
const PaletteRow = Schema.Struct({
  entry: Schema.Option(SearchEntry),
  go: Schema.Union([
    Schema.TaggedStruct("page", { href: Schema.String }),
    Schema.TaggedStruct("search", { query: Schema.String }),
  ]),
  icon: Schema.Union([Schema.String, RowIcon]),
  key: Schema.String,
  parts: Schema.Array(TitlePart),
  trail: Schema.String,
});
export type PaletteRow = typeof PaletteRow.Type;

/** One group of rows under its label. */
const PaletteGroup = Schema.Struct({
  items: Schema.Array(PaletteRow),
  key: Schema.String,
  label: Schema.String,
});
export type PaletteGroup = typeof PaletteGroup.Type;

/** What reading the index settled with, while it is still on its way. */
type IndexAnswer = Option.Option<
  Result.Result<
    Effect.Success<ReturnType<typeof readSearchIndex>>,
    SearchIndexUnavailable
  >
>;

/** The rows of one group, each with an icon that no other row of the group holds. */
function readRows(
  group: string,
  entries: readonly SearchEntry[],
  query: string
): readonly PaletteRow[] {
  const looks = getTileLooks(
    Arr.map(
      entries,
      (entry) => entry.flag ?? ([KIND_ICONS[entry.kind], entry.path] as const)
    )
  );
  return Arr.map(Arr.zip(entries, looks), ([entry, look]) => ({
    entry: Option.some(entry),
    go: { _tag: "page", href: entry.path },
    icon: Predicate.isString(look) ? look : look.icon,
    key: `${group}:${entry.path}`,
    parts: markTitle(entry.title, query),
    trail: Arr.join(entry.trail, " › "),
  }));
}

/** The words of each group's label. */
function useGroupLabels(): Readonly<Record<SearchGroup, string>> {
  const t = useTranslations("Utils");
  return {
    articles: t("search-group-articles"),
    curricula: t("search-group-curricula"),
    lessons: t("search-group-lessons"),
    pages: t("search-group-pages"),
    quran: t("search-group-quran"),
    tryouts: t("search-group-tryouts"),
  };
}

/**
 * The groups the palette lists. Before a query: the reader's recent pages, the
 * subjects or levels around the page on screen, and each family's way in. With a
 * query: the matching pages grouped by family, best group first, and last a row
 * that searches inside every lesson on the search page.
 */
export function usePaletteGroups({
  answer,
  query,
  recent,
}: {
  answer: IndexAnswer;
  query: string;
  recent: readonly SearchEntry[];
}): readonly PaletteGroup[] {
  const t = useTranslations("Utils");
  const tCommon = useTranslations("Common");
  const labels = useGroupLabels();
  const locale = useLocale();
  const here = useLocation({
    select: (location) => new URL(location.publicHref, SITE_ORIGIN).pathname,
  });
  const loaded = Option.flatMap(answer, Result.getSuccess);
  const ownRecent = Arr.filter(recent, ({ path }) =>
    path.startsWith(`/${locale}/`)
  );

  if (query.trim() === "") {
    const entries = Option.match(loaded, {
      onNone: () => [],
      onSome: (index) => index.entries,
    });
    const near = readNearEntries(entries, [
      here,
      ...Arr.map(ownRecent, ({ path }) => path),
    ]);
    return Arr.filter(
      [
        {
          key: "recent",
          label: t("search-recent"),
          items: readRows("recent", ownRecent, ""),
        },
        {
          key: "near",
          label: t("search-near"),
          items: readRows("near", near, ""),
        },
        {
          key: "explore",
          label: t("search-explore"),
          items: readRows("explore", readExploreEntries(entries), ""),
        },
      ],
      ({ items }) => items.length > 0
    );
  }

  const found = Option.match(loaded, {
    onNone: () => [],
    onSome: (index) => groupHits(searchEntries(index.prepared, query)),
  });
  const full: PaletteRow = {
    entry: Option.none(),
    go: { _tag: "search", query: query.trim() },
    icon: Search02Icon,
    key: "full",
    parts: [
      { hit: false, start: 0, text: t("search-full", { query: query.trim() }) },
    ],
    trail: "",
  };
  return [
    ...Arr.map(found, ({ group, hits }) => ({
      key: group,
      label: labels[group],
      items: readRows(
        group,
        Arr.map(hits, ({ entry }) => entry),
        query
      ),
    })),
    { items: [full], key: "full", label: tCommon("search") },
  ];
}

/** One row: its flag or icon, its title with the matched words marked, and the pages above it. */
export function SearchRow({ row }: { row: PaletteRow }) {
  return (
    <>
      {Predicate.isString(row.icon) ? (
        <CountryFlagIcon
          className="ring-border/60 h-3 w-4.5 shrink-0 rounded-[2px] ring-1"
          countryCode={row.icon}
        />
      ) : (
        <HugeIcons icon={row.icon} />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">
          {Arr.map(row.parts, (part) =>
            part.hit ? (
              <mark
                className="text-foreground bg-transparent font-semibold"
                key={part.start}
              >
                {part.text}
              </mark>
            ) : (
              part.text
            )
          )}
        </span>
        {row.trail !== "" && (
          <span className="text-muted-foreground group-data-highlighted:text-accent-foreground/80 truncate text-sm">
            {row.trail}
          </span>
        )}
      </span>
    </>
  );
}
