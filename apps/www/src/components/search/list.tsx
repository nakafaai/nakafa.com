import {
  FileIcon,
  InformationCircleIcon,
  Rocket01Icon,
} from "@hugeicons/core-free-icons";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
} from "@repo/design-system/components/ui/empty";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Separator } from "@repo/design-system/components/ui/separator";
import { cn } from "cn";
import { Array as Arr } from "effect";
import { createContext, Fragment, type ReactElement, use } from "react";
import { useTranslations } from "use-intl";
import { SearchExcerpt } from "@/components/search/excerpt";
import { useSearchSectionLabels } from "@/components/search/labels";
import { EmptyNina } from "@/components/state/empty";
import { PublicPathLink } from "@/lib/routing/public/link";
import { EXACT_ACTIVE_OPTIONS } from "@/lib/routing/tree";
import type { ContentSearchResultItem } from "@/lib/search/answer";

interface Props {
  error: string | ReactElement;
  isError: boolean;
  isLoading: boolean;
  query: string;
  results: ContentSearchResultItem[];
}

type SearchResultGroup = ReturnType<typeof getSearchResultGroups>[number];

/** The query whose results the page shows, which each result's excerpt highlights. */
const ResultsQueryContext = createContext<string | null>(null);

/** Reads the query whose results the page shows. */
function useResultsQuery() {
  const query = use(ResultsQueryContext);
  if (query === null) {
    throw new Error("useResultsQuery must be used within SearchResults");
  }
  return query;
}

/** Renders full-page Convex search states and grouped results. */
export function SearchResults({
  results,
  query,
  isLoading,
  isError,
  error,
}: Props) {
  const t = useTranslations("Utils");
  const sectionLabels = useSearchSectionLabels();

  if (isError) {
    return (
      <div className="flex items-center justify-center gap-1 text-muted-foreground text-sm">
        <HugeIcons className="size-4" icon={InformationCircleIcon} />
        <div className="mt-1">{t("search-error")}</div>
        <div className="wrap-break-word mt-2 max-w-xs text-xs">{error}</div>
      </div>
    );
  }

  if (!query) {
    return (
      <div className="flex items-center justify-center gap-1 text-muted-foreground text-sm">
        <HugeIcons className="size-4" icon={Rocket01Icon} />
        <p>{t("search-help")}</p>
      </div>
    );
  }

  if (isLoading) {
    return null;
  }

  if (results.length === 0 && query) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyNina act="searching" />
          <EmptyDescription>{t("search-not-found")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const groups = getSearchResultGroups(results, sectionLabels);

  return (
    <ResultsQueryContext value={query}>
      <div className="flex flex-col gap-3 rounded-xl border py-4 shadow-sm">
        {Arr.map(groups, (group, index) => (
          <Fragment key={group.title}>
            <ResultGroup group={group} />
            {index !== groups.length - 1 && <Separator />}
          </Fragment>
        ))}
      </div>
    </ResultsQueryContext>
  );
}

/** Renders one grouped Convex search result section. */
function ResultGroup({ group }: { group: SearchResultGroup }) {
  const query = useResultsQuery();
  return (
    <div className="space-y-2">
      <h2 className="px-4 font-medium text-muted-foreground text-sm">
        {group.title}
      </h2>
      <div className="flex flex-col gap-1">
        {Arr.map(group.items, (result) => (
          <PublicPathLink
            activeOptions={EXACT_ACTIVE_OPTIONS}
            className={cn(
              "group flex flex-col gap-2 p-2 px-4 text-sm transition-colors ease-out hover:bg-accent hover:text-accent-foreground"
            )}
            key={result.content_id}
            publicPath={result.route}
          >
            <div className="flex items-center gap-2">
              <HugeIcons
                className="size-4 shrink-0 text-muted-foreground group-hover:text-accent-foreground"
                icon={FileIcon}
              />
              <span className="line-clamp-1">{result.title}</span>
            </div>
            <SearchExcerpt
              className="line-clamp-3 text-muted-foreground text-sm group-hover:text-accent-foreground group-hover:[&_mark]:text-accent-foreground"
              excerpt={result.excerpt}
              query={query}
            />
          </PublicPathLink>
        ))}
      </div>
    </div>
  );
}

/** Groups flat Convex search results by section for page rendering. */
function getSearchResultGroups(
  results: ContentSearchResultItem[],
  sectionLabels: Record<ContentSearchResultItem["section"], string>
) {
  return Arr.map(
    Arr.dedupe(Arr.map(results, (result) => result.section)),
    (section) => ({
      items: Arr.filter(results, (result) => result.section === section),
      title: sectionLabels[section],
    })
  );
}
