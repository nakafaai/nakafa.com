import { FileIcon, InformationCircleIcon } from "@hugeicons/core-free-icons";
import { useDebouncedValue } from "@mantine/hooks";
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandSeparator,
} from "@repo/design-system/components/ui/command";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useNavigate } from "@tanstack/react-router";
import { Array as Arr, Option } from "effect";
import type { ComponentProps, ReactElement } from "react";
import { Fragment, useLayoutEffect, useTransition } from "react";
import { useLocale, useTranslations } from "use-intl";
import { getArticleCategoryIcons } from "@/components/articles/category";
import { SearchExcerpt } from "@/components/search/excerpt";
import { CommandKeys } from "@/components/search/keys";
import { useSearchSectionLabels } from "@/components/search/labels";
import { useArticleNavigation } from "@/components/search/navigation";
import { holyMenu } from "@/components/sidebar/data/holy";
import {
  getSubjectMenuHref,
  getSubjectMenuTarget,
  subjectMenu,
} from "@/components/sidebar/data/subject";
import { EmptyNina } from "@/components/state/empty";
import type { ArticleNavigationItem } from "@/lib/content/article/navigation";
import { getErrorMessage } from "@/lib/failure";
import type { LinkTarget } from "@/lib/routing/link";
import { articleCategoryTarget, publicPathTarget } from "@/lib/routing/target";
import type { ContentSearchResultItem } from "@/lib/search/answer";
import { useSearch } from "@/lib/search/context";
import { useSearchQuery } from "@/lib/search/query";

const DEBOUNCE_TIME = 500;

type SearchCommandIcon = ComponentProps<typeof HugeIcons>["icon"];

/** Props of the result list: the groups it renders, with navigation icons. */
interface SearchListProps {
  groups: {
    items: (
      | {
          excerpt: string;
          key: string;
          publicPath: string;
          label: string;
          query: string;
          type: "content";
          value: string;
        }
      | {
          icon: SearchCommandIcon;
          key: string;
          label: string;
          target: LinkTarget;
          type: "navigation";
          value: string;
        }
    )[];
    value: string;
  }[];
}

type SearchCommandGroup = SearchListProps["groups"][number];
type SearchCommandItem = SearchCommandGroup["items"][number];

/**
 * Renders the global command menu used across the main app shell.
 */
export function SearchCommand() {
  const t = useTranslations("Utils");
  const tCommon = useTranslations("Common");
  const { open, setOpen } = useSearch((state) => ({
    open: state.open,
    setOpen: state.setOpen,
  }));

  useLayoutEffect(
    () => () => {
      setOpen(false);
    },
    [setOpen]
  );

  return (
    <CommandDialog onOpenChange={setOpen} open={open}>
      <CommandDialogPopup
        description={t("search-description")}
        initialFocus
        portalProps={{ keepMounted: true }}
        title={tCommon("search")}
      >
        <SearchMain />
      </CommandDialogPopup>
    </CommandDialog>
  );
}

/** Coordinates debounced Convex content search inside the command dialog. */
function SearchMain() {
  const t = useTranslations("Utils");
  const tCommon = useTranslations("Common");
  const query = useSearch((state) => state.query);
  const setQuery = useSearch((state) => state.setQuery);
  const articleNavigation = useArticleNavigation();
  const defaultGroups = useDefaultSearchGroups(articleNavigation);
  const sectionLabels = useSearchSectionLabels();
  const [debouncedSearch] = useDebouncedValue(query, DEBOUNCE_TIME);
  const currentSearch = query.trim();
  const search = debouncedSearch.trim();
  const isSearching = currentSearch.length > 0;
  const isDebouncing = isSearching && currentSearch !== search;

  const {
    data: results = [],
    isError,
    error,
    isLoading,
  } = useSearchQuery({
    enabled: Boolean(search),
    query: search,
  });

  const hasError = isError;
  const displayError = error ? getErrorMessage(error) : "";
  const showLoading =
    isSearching && !hasError && (isDebouncing || Boolean(isLoading));
  const resultGroups = getResultGroups(results, sectionLabels, search);
  let groups = defaultGroups;

  if (isSearching && search) {
    groups = resultGroups;
  }

  if (
    hasError ||
    showLoading ||
    (isSearching && search && results.length === 0)
  ) {
    groups = [];
  }

  return (
    <Command
      filter={null}
      items={groups}
      itemToStringValue={searchCommandItemToString}
      key={isSearching ? "search" : "default"}
      loopFocus
      mode="none"
      onValueChange={setQuery}
      value={query}
    >
      <CommandInput
        clearLabel={tCommon("clear-search")}
        placeholder={t("search-placeholder")}
      />
      <CommandPanel>
        <SearchEmpty
          error={hasError ? displayError : ""}
          isLoading={showLoading}
          search={currentSearch}
        />
        <SearchList groups={groups} />
      </CommandPanel>
      <CommandKeys />
    </Command>
  );
}

function SearchEmpty({
  error,
  isLoading,
  search,
}: {
  error: ReactElement | string;
  isLoading: boolean;
  search: string;
}) {
  const t = useTranslations("Utils");

  return (
    <CommandEmpty className="not-empty:flex not-empty:flex-col not-empty:items-center not-empty:justify-center not-empty:gap-1 not-empty:p-7.5 text-center text-muted-foreground text-sm">
      {!!error && (
        <>
          <HugeIcons className="size-4" icon={InformationCircleIcon} />
          <div className="mt-1">{t("search-error")}</div>
          <div className="wrap-break-word mt-2 max-w-xs text-xs">{error}</div>
        </>
      )}
      {!error && isLoading && (
        <>
          <Spinner className="size-4" />
          <p>{t("search-loading")}</p>
        </>
      )}
      {!(error || isLoading) && !!search && (
        <>
          <EmptyNina act="searching" />
          <p>{t("search-not-found")}</p>
        </>
      )}
    </CommandEmpty>
  );
}

function SearchList({ groups }: SearchListProps) {
  const navigate = useNavigate();
  const setOpen = useSearch((state) => state.setOpen);
  const [isPending, startTransition] = useTransition();

  function navigateTo(target: LinkTarget) {
    startTransition(() => {
      setOpen(false);
      navigate(target);
    });
  }

  /** Opens a navigation row at its target, and a content row at its public path. */
  function navigateToItem(item: SearchCommandItem) {
    if (item.type === "navigation") {
      navigateTo(item.target);
      return;
    }
    Option.map(publicPathTarget(item.publicPath), navigateTo);
  }

  return (
    <CommandList>
      {(group: SearchCommandGroup, index: number) => (
        <Fragment key={group.value}>
          <CommandGroup items={group.items}>
            <CommandGroupLabel>{group.value}</CommandGroupLabel>
            <CommandCollection>
              {(item: SearchCommandItem) => (
                <SearchListItem
                  isPending={isPending}
                  item={item}
                  key={item.key}
                  onClick={() => navigateToItem(item)}
                />
              )}
            </CommandCollection>
          </CommandGroup>
          {index !== groups.length - 1 && <CommandSeparator className="my-2" />}
        </Fragment>
      )}
    </CommandList>
  );
}

/** Renders one navigation or content result inside the command list. */
function SearchListItem({
  isPending,
  item,
  onClick,
}: {
  isPending: boolean;
  item: SearchCommandItem;
  onClick: () => void;
}) {
  if (item.type === "content") {
    return (
      <CommandItem
        className="group cursor-pointer flex-col items-start"
        disabled={isPending}
        onClick={onClick}
        value={item}
      >
        <div className="flex items-center gap-2">
          <HugeIcons icon={FileIcon} />
          <span className="line-clamp-1">{item.label}</span>
        </div>
        <SearchExcerpt
          className="line-clamp-3 text-muted-foreground text-xs group-data-highlighted:text-accent-foreground group-data-highlighted:[&_mark]:text-accent-foreground"
          excerpt={item.excerpt}
          query={item.query}
        />
      </CommandItem>
    );
  }

  return (
    <CommandItem
      className="cursor-pointer"
      disabled={isPending}
      onClick={onClick}
      value={item}
    >
      <HugeIcons icon={item.icon} />
      <span className="line-clamp-1">{item.label}</span>
    </CommandItem>
  );
}

/** Builds localized default navigation groups shown before content search runs. */
function useDefaultSearchGroups(
  articleNavigation: readonly ArticleNavigationItem[]
): SearchCommandGroup[] {
  const tSubject = useTranslations("Subject");
  const tArticles = useTranslations("Articles");
  const tHoly = useTranslations("Holy");
  const locale = useLocale();

  const subjectGroups = Arr.map(subjectMenu, (item) => {
    const groupTitle = tSubject(item.title);

    return {
      items: Arr.map(item.items, (subItem) => {
        const label = tSubject(subItem.title, { grade: subItem.value });
        const href = getSubjectMenuHref(subItem, locale);

        return {
          icon: subItem.icon,
          key: href,
          label,
          target: getSubjectMenuTarget(subItem, locale),
          type: "navigation" as const,
          value: `${groupTitle} ${label}`,
        };
      }),
      value: groupTitle,
    };
  });

  return [
    ...subjectGroups,
    {
      items: Arr.zipWith(
        articleNavigation,
        getArticleCategoryIcons(articleNavigation),
        (item, icon): SearchCommandItem => ({
          icon,
          key: item.route,
          label: item.title,
          target: articleCategoryTarget(item.route),
          type: "navigation",
          value: `${tArticles("articles")} ${item.title}`,
        })
      ),
      value: tArticles("articles"),
    },
    {
      items: Arr.map(holyMenu, (item) => {
        const label = tHoly(item.title);

        return {
          icon: item.icon,
          key: `holy:${item.title}`,
          label,
          target: item.target,
          type: "navigation" as const,
          value: `${tHoly("holy")} ${label}`,
        };
      }),
      value: tHoly("holy"),
    },
  ];
}

/** Groups flat Convex search results by section for command rendering. */
function getResultGroups(
  results: ContentSearchResultItem[],
  sectionLabels: Record<ContentSearchResultItem["section"], string>,
  query: string
): SearchCommandGroup[] {
  return Arr.map(
    Arr.dedupe(Arr.map(results, (result) => result.section)),
    (section) => ({
      items: Arr.map(
        Arr.filter(results, (result) => result.section === section),
        (result): SearchCommandItem => ({
          excerpt: result.excerpt,
          key: result.content_id,
          label: result.title,
          publicPath: result.route,
          query,
          type: "content",
          value: `${result.title} ${result.description} ${result.route}`,
        })
      ),
      value: sectionLabels[section],
    })
  );
}

function searchCommandItemToString(item: SearchCommandItem) {
  return item.value;
}
