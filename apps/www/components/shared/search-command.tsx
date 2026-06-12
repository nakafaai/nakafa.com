"use client";

import {
  ArrowDown02Icon,
  ArrowMoveDownLeftIcon,
  ArrowUp02Icon,
  FileIcon,
  InformationCircleIcon,
  Sad02Icon,
} from "@hugeicons/core-free-icons";
import { useDebouncedValue, useHotkeys } from "@mantine/hooks";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandSeparator,
} from "@repo/design-system/components/ui/command";
import { EmptyMedia } from "@repo/design-system/components/ui/empty";
import { Kbd, KbdGroup } from "@repo/design-system/components/ui/kbd";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useTranslations } from "next-intl";
import type { ComponentProps, ReactElement } from "react";
import { Fragment, useLayoutEffect, useTransition } from "react";
import { SearchExcerpt } from "@/components/shared/search-excerpt";
import { articlesMenu } from "@/components/sidebar/_data/articles";
import { holyMenu } from "@/components/sidebar/_data/holy";
import { subjectMenu } from "@/components/sidebar/_data/subject";
import {
  type ContentSearchResultItem,
  useSearchQuery,
} from "@/lib/content/use-search-query";
import { useSearch } from "@/lib/context/use-search";
import { getErrorMessage } from "@/lib/utils/error";

const DEBOUNCE_TIME = 500;

type SearchCommandIcon = ComponentProps<typeof HugeIcons>["icon"];

type SearchCommandItem =
  | {
      excerpt: string;
      href: string;
      key: string;
      label: string;
      query: string;
      type: "content";
      value: string;
    }
  | {
      href: string;
      icon: SearchCommandIcon;
      key: string;
      label: string;
      type: "navigation";
      value: string;
    };

interface SearchCommandGroup {
  items: SearchCommandItem[];
  value: string;
}

/**
 * Renders the global command menu used across the main app shell.
 */
export function SearchCommand() {
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

  useHotkeys([
    ["/", () => setOpen(true)],
    ["mod+K", () => setOpen(true)],
  ]);

  return (
    <CommandDialog onOpenChange={setOpen} open={open}>
      <CommandDialogPopup>
        <SearchMain />
      </CommandDialogPopup>
    </CommandDialog>
  );
}

/** Coordinates debounced Convex content search inside the command dialog. */
function SearchMain() {
  const t = useTranslations("Utils");
  const query = useSearch((state) => state.query);
  const setQuery = useSearch((state) => state.setQuery);
  const defaultGroups = useDefaultSearchGroups();
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
      <CommandInput placeholder={t("search-placeholder")} />
      <CommandPanel>
        <SearchEmpty
          error={hasError ? displayError : ""}
          isLoading={showLoading}
          search={currentSearch}
        />
        <SearchList groups={groups} />
      </CommandPanel>
      <Footer />
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
    <CommandEmpty className="not-empty:py-12">
      {!!error && (
        <div className="mx-auto flex max-w-sm flex-col items-center gap-2 px-6 text-center">
          <EmptyMedia variant="icon">
            <HugeIcons icon={InformationCircleIcon} />
          </EmptyMedia>
          <div className="font-medium">{t("search-error")}</div>
          {typeof error === "string" || typeof error === "object" ? (
            <div className="wrap-break-word max-w-xs text-muted-foreground text-xs">
              {error}
            </div>
          ) : null}
        </div>
      )}
      {!error && isLoading && (
        <div className="flex flex-col items-center gap-2 px-6 text-center text-muted-foreground">
          <Spinner className="size-4" />
          <p>{t("search-loading")}</p>
        </div>
      )}
      {!(error || isLoading) && !!search && (
        <div className="mx-auto flex max-w-sm flex-col items-center gap-2 px-6 text-center">
          <EmptyMedia variant="icon">
            <HugeIcons icon={Sad02Icon} />
          </EmptyMedia>
          <p className="text-muted-foreground">{t("search-not-found")}</p>
        </div>
      )}
    </CommandEmpty>
  );
}

function SearchList({ groups }: { groups: SearchCommandGroup[] }) {
  const router = useRouter();
  const setOpen = useSearch((state) => state.setOpen);
  const [isPending, startTransition] = useTransition();

  function navigate(href: string) {
    startTransition(() => {
      setOpen(false);
      router.push(href);
    });
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
                  onClick={() => navigate(item.href)}
                />
              )}
            </CommandCollection>
          </CommandGroup>
          {index !== groups.length - 1 && <CommandSeparator />}
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
        className="items-start gap-3 py-2"
        disabled={isPending}
        onClick={onClick}
        value={item}
      >
        <HugeIcons
          className="mt-0.5 size-4 text-muted-foreground"
          icon={FileIcon}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{item.label}</span>
          <SearchExcerpt
            className="mt-1 line-clamp-2 text-muted-foreground text-xs"
            excerpt={item.excerpt}
            query={item.query}
          />
        </span>
      </CommandItem>
    );
  }

  return (
    <CommandItem disabled={isPending} onClick={onClick} value={item}>
      <HugeIcons className="size-4 text-muted-foreground" icon={item.icon} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
    </CommandItem>
  );
}

/** Builds localized default navigation groups shown before content search runs. */
function useDefaultSearchGroups(): SearchCommandGroup[] {
  const tSubject = useTranslations("Subject");
  const tArticles = useTranslations("Articles");
  const tHoly = useTranslations("Holy");

  const subjectGroups = subjectMenu.map((item) => {
    const groupTitle = tSubject(item.title);

    return {
      items: item.items.map((subItem) => {
        const label =
          "value" in subItem
            ? tSubject(subItem.title, { grade: subItem.value })
            : tSubject(subItem.title);

        return {
          href: subItem.href,
          icon: item.icon,
          key: subItem.href,
          label,
          type: "navigation" as const,
          value: `${groupTitle} ${label} ${subItem.href}`,
        };
      }),
      value: groupTitle,
    };
  });

  return [
    ...subjectGroups,
    {
      items: articlesMenu.map((item) => {
        const label = tArticles(item.title);

        return {
          href: item.href,
          icon: item.icon,
          key: item.href,
          label,
          type: "navigation" as const,
          value: `${tArticles("articles")} ${label} ${item.href}`,
        };
      }),
      value: tArticles("articles"),
    },
    {
      items: holyMenu.map((item) => {
        const label = tHoly(item.title);

        return {
          href: item.href,
          icon: item.icon,
          key: item.href,
          label,
          type: "navigation" as const,
          value: `${tHoly("holy")} ${label} ${item.href}`,
        };
      }),
      value: tHoly("holy"),
    },
  ];
}

/** Resolves localized section labels for grouped command search results. */
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

/** Groups flat Convex search results by section for command rendering. */
function getResultGroups(
  results: ContentSearchResultItem[],
  sectionLabels: Record<ContentSearchResultItem["section"], string>,
  query: string
): SearchCommandGroup[] {
  const groups = new Map<
    ContentSearchResultItem["section"],
    SearchCommandGroup
  >();

  for (const result of results) {
    const value = sectionLabels[result.section];
    const group = groups.get(result.section) ?? { items: [], value };

    group.items.push({
      excerpt: result.excerpt,
      href: `/${result.route}`,
      key: result.content_id,
      label: result.title,
      query,
      type: "content",
      value: `${result.title} ${result.description} ${result.route}`,
    });

    groups.set(result.section, group);
  }

  return Array.from(groups.values());
}

function searchCommandItemToString(item: SearchCommandItem) {
  return item.value;
}

function Footer() {
  const t = useTranslations("Common");

  return (
    <CommandFooter>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <KbdGroup>
            <Kbd>
              <HugeIcons icon={ArrowUp02Icon} />
            </Kbd>
            <Kbd>
              <HugeIcons icon={ArrowDown02Icon} />
            </Kbd>
          </KbdGroup>
          <span>{t("navigate")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Kbd>
            <HugeIcons icon={ArrowMoveDownLeftIcon} />
          </Kbd>
          <span>{t("open")}</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Kbd>Esc</Kbd>
        <span>{t("close")}</span>
      </div>
    </CommandFooter>
  );
}
