import {
  FileIcon,
  InformationCircleIcon,
  Rocket01Icon,
  Sad02Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import { Fragment, type ReactElement } from "react";
import { SearchExcerpt } from "@/components/shared/search-excerpt";
import type { ContentSearchResultItem } from "@/lib/content/use-search-query";

interface Props {
  error: string | ReactElement;
  isError: boolean;
  isLoading: boolean;
  query: string;
  results: ContentSearchResultItem[];
}

interface SearchResultGroup {
  items: ContentSearchResultItem[];
  title: string;
}

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
        {typeof error === "string" || typeof error === "object" ? (
          <div className="wrap-break-word mt-2 max-w-xs text-xs">{error}</div>
        ) : null}
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
    return (
      <div className="flex items-center justify-center gap-1 text-muted-foreground text-sm">
        <Spinner className="size-4" />
        <p>{t("search-loading")}</p>
      </div>
    );
  }

  if (results.length === 0 && query) {
    return (
      <div className="flex items-center justify-center gap-1 text-muted-foreground text-sm">
        <HugeIcons className="size-4" icon={Sad02Icon} />
        <p>{t("search-not-found")}</p>
      </div>
    );
  }

  const groups = getSearchResultGroups(results, sectionLabels);

  return (
    <div className="flex flex-col gap-3 rounded-xl border py-4 shadow-sm">
      {groups.map((group, index) => (
        <Fragment key={group.title}>
          <ResultGroup group={group} query={query} />
          {index !== groups.length - 1 && <Separator />}
        </Fragment>
      ))}
    </div>
  );
}

/** Renders one grouped Convex search result section. */
function ResultGroup({
  group,
  query,
}: {
  group: SearchResultGroup;
  query: string;
}) {
  return (
    <div className="space-y-2">
      <h2 className="px-4 font-medium text-muted-foreground text-sm">
        {group.title}
      </h2>
      <div className="flex flex-col gap-1">
        {group.items.map((result) => (
          <NavigationLink
            className={cn(
              "group flex flex-col gap-2 p-2 px-4 text-sm transition-colors ease-out hover:bg-accent hover:text-accent-foreground"
            )}
            href={`/${result.route}`}
            key={result.content_id}
          >
            <div className="flex items-center gap-2">
              <HugeIcons
                className="size-4 shrink-0 text-muted-foreground group-hover:text-accent-foreground"
                icon={FileIcon}
              />
              <span className="line-clamp-1">{result.title}</span>
            </div>
            <SearchExcerpt
              className="line-clamp-3 text-muted-foreground text-sm group-hover:text-accent-foreground"
              excerpt={result.excerpt}
              query={query}
            />
          </NavigationLink>
        ))}
      </div>
    </div>
  );
}

function useSearchSectionLabels(): Record<
  ContentSearchResultItem["section"],
  string
> {
  const tCommon = useTranslations("Common");
  const tArticles = useTranslations("Articles");
  const tExercises = useTranslations("Exercises");
  const tHoly = useTranslations("Holy");

  return {
    articles: tArticles("articles"),
    exercises: tExercises("exercises"),
    quran: tHoly("quran"),
    subject: tCommon("subject"),
  };
}

function getSearchResultGroups(
  results: ContentSearchResultItem[],
  sectionLabels: Record<ContentSearchResultItem["section"], string>
) {
  const groups = new Map<
    ContentSearchResultItem["section"],
    SearchResultGroup
  >();

  for (const result of results) {
    const group = groups.get(result.section) ?? {
      items: [],
      title: sectionLabels[result.section],
    };

    group.items.push(result);
    groups.set(result.section, group);
  }

  return Array.from(groups.values());
}
