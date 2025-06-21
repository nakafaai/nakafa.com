"use client";

import { getErrorMessage, usePagefind } from "@/lib/context/use-pagefind";
import { useSearch } from "@/lib/context/use-search";
import { useSearchQuery } from "@/lib/react-query/use-search";
import { getAnchorStyle } from "@/lib/utils/search";
import type { PagefindResult } from "@/types/pagefind";
import { useDebouncedValue } from "@mantine/hooks";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@repo/design-system/components/ui/command";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import { cn } from "@repo/design-system/lib/utils";
import { IconCommand, IconLetterK, IconMenu3 } from "@tabler/icons-react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CornerDownLeftIcon,
  HeartCrackIcon,
  InfoIcon,
} from "lucide-react";
import { FileTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Fragment, startTransition, useEffect, useTransition } from "react";
import type { ReactElement } from "react";
import { articlesMenu } from "../sidebar/_data/articles";
import { subjectAll } from "../sidebar/_data/subject";

export function SearchCommand() {
  const { open, setOpen } = useSearch((state) => ({
    open: state.open,
    setOpen: state.setOpen,
  }));

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const el = document.activeElement;
      if (!el || (el as HTMLElement).isContentEditable) {
        return;
      }
      if (
        event.key === "/" ||
        (event.key === "k" &&
          !event.shiftKey &&
          (navigator.userAgent.includes("Mac") ? event.metaKey : event.ctrlKey))
      ) {
        event.preventDefault();
        setOpen(!open);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [setOpen, open]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      commandProps={{
        shouldFilter: false, // filter by pagefind results
        loop: true,
      }}
    >
      <SearchMain />
      <Footer />
    </CommandDialog>
  );
}

function SearchMain() {
  const { query, setQuery } = useSearch((state) => ({
    query: state.query,
    setQuery: state.setQuery,
  }));

  return (
    <>
      <SearchInput value={query} onChange={setQuery} />
      <SearchList search={query} />
    </>
  );
}

function SearchInput({
  value,
  onChange,
}: { value: string; onChange: (value: string) => void }) {
  const t = useTranslations("Utils");

  return (
    <CommandInput
      placeholder={t("search-placeholder")}
      value={value}
      onValueChange={onChange}
      autoFocus
    />
  );
}

function SearchList({ search }: { search: string }) {
  const pagefindError = usePagefind((context) => context.error);

  const [debouncedSearch] = useDebouncedValue(search, 300);

  const {
    data: results = [],
    isError,
    error,
    isLoading,
    isPlaceholderData,
  } = useSearchQuery({
    query: debouncedSearch,
    enabled: !!debouncedSearch,
  });

  // Combine initialization error with query error
  const hasError = isError || !!pagefindError;
  const displayError = pagefindError || (error ? getErrorMessage(error) : "");

  return (
    <CommandList className="h-full md:max-h-[500px]">
      <SearchListItems
        error={hasError ? displayError : ""}
        search={debouncedSearch}
        isLoading={isLoading && !hasError && !isPlaceholderData}
        results={results}
      />
    </CommandList>
  );
}

function SearchListItems({
  error,
  search,
  isLoading,
  results,
}: {
  error: ReactElement | string;
  search: string;
  isLoading: boolean;
  results: PagefindResult[];
}) {
  const t = useTranslations("Utils");
  const router = useRouter();
  const setOpen = useSearch((state) => state.setOpen);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const subResultsToPrefetch = results.flatMap(
      (result) => result.sub_results
    );
    for (const subResult of subResultsToPrefetch) {
      // router prefetch will manage that it will not prefetch the same url twice
      router.prefetch(subResult.url);
    }
  }, [results, router]);

  if (error) {
    return (
      <CommandEmpty className="flex flex-col items-center justify-center gap-1 p-7.5 text-center text-muted-foreground text-sm">
        <InfoIcon className="size-4" />
        <div className="mt-1">{t("search-error")}</div>
        {typeof error === "string" || typeof error === "object" ? (
          <div className="mt-2 max-w-xs break-words text-xs">{error}</div>
        ) : null}
      </CommandEmpty>
    );
  }

  if (!search) {
    return <DefaultItems />;
  }

  if (isLoading) {
    return (
      <CommandEmpty className="flex items-center justify-center gap-1 p-7.5 text-muted-foreground text-sm">
        <SpinnerIcon />
        <p>{t("search-loading")}</p>
      </CommandEmpty>
    );
  }

  if (results.length === 0 && search) {
    return (
      <CommandEmpty className="flex items-center justify-center gap-1 p-7.5 text-muted-foreground text-sm">
        <HeartCrackIcon className="size-4" />
        <p>{t("search-not-found")}</p>
      </CommandEmpty>
    );
  }

  return results.map((result, index) => (
    <Fragment key={result.url}>
      <CommandGroup heading={result.meta.title}>
        {result.sub_results.map((subResult) => (
          <CommandItem
            key={`${subResult.url}-${subResult.title}`}
            value={`${result.meta.title} ${subResult.title} ${subResult.url}`}
            className={cn("cursor-pointer", getAnchorStyle(subResult.anchor))}
            onSelect={() => {
              startTransition(() => {
                setOpen(false);
                router.push(subResult.url);
              });
            }}
            disabled={isPending}
          >
            {subResult.anchor?.element === "h2" ? (
              <FileTextIcon />
            ) : (
              <IconMenu3 />
            )}
            <span className="line-clamp-1">{subResult.title}</span>
          </CommandItem>
        ))}
      </CommandGroup>
      {results.length > 1 && index !== results.length - 1 && (
        <CommandSeparator alwaysRender className="my-2" />
      )}
    </Fragment>
  ));
}

function DefaultItems() {
  const t = useTranslations("Subject");
  const tArticles = useTranslations("Articles");
  const router = useRouter();
  const setOpen = useSearch((state) => state.setOpen);

  useEffect(() => {
    // prefetch all the links
    for (const item of subjectAll) {
      for (const subItem of item.items) {
        router.prefetch(subItem.href);
      }
    }

    for (const item of articlesMenu) {
      router.prefetch(item.href);
    }
  }, [router]);

  return (
    <>
      {subjectAll.map((item) => (
        <CommandGroup key={item.title} heading={t(item.title)}>
          {item.items.map((subItem) => {
            let title = "";
            // Only grade that has value
            if ("value" in subItem) {
              title = t(subItem.title, { grade: subItem.value });
            }

            return (
              <CommandItem
                key={title}
                value={title}
                className="cursor-pointer"
                onSelect={() => {
                  startTransition(() => {
                    setOpen(false);
                    router.push(subItem.href);
                  });
                }}
              >
                <item.icon />
                <span className="line-clamp-1">{title}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      ))}

      <CommandSeparator alwaysRender className="my-2" />

      <CommandGroup heading={tArticles("articles")}>
        {articlesMenu.map((item) => (
          <CommandItem
            key={item.title}
            value={tArticles(item.title)}
            className="cursor-pointer"
            onSelect={() => {
              startTransition(() => {
                setOpen(false);
                router.push(item.href);
              });
            }}
          >
            <item.icon />
            <span className="line-clamp-1">{tArticles(item.title)}</span>
          </CommandItem>
        ))}
      </CommandGroup>
    </>
  );
}

function Footer() {
  const t = useTranslations("Common");

  return (
    <div className="flex items-center justify-between border-t p-3 text-muted-foreground text-sm">
      <div className="flex items-center gap-1">
        <kbd className="pointer-events-none flex size-5 select-none items-center justify-center rounded border bg-muted">
          <CornerDownLeftIcon className="size-3 text-muted-foreground" />
        </kbd>
        <span>{t("select")}</span>
      </div>
      <div className="flex items-center gap-1">
        <kbd className="pointer-events-none flex size-5 select-none items-center justify-center rounded border bg-muted">
          <ArrowUpIcon className="size-3 text-muted-foreground" />
        </kbd>
        <kbd className="pointer-events-none flex size-5 select-none items-center justify-center rounded border bg-muted">
          <ArrowDownIcon className="size-3 text-muted-foreground" />
        </kbd>
        <span>{t("navigate")}</span>
      </div>
      <div className="flex items-center gap-1">
        <kbd className="pointer-events-none flex size-5 select-none items-center justify-center rounded border bg-muted">
          <IconCommand className="size-3 text-muted-foreground" />
        </kbd>
        <kbd className="pointer-events-none flex size-5 select-none items-center justify-center rounded border bg-muted">
          <IconLetterK className="size-3 text-muted-foreground" />
        </kbd>
        <span>{t("close")}</span>
      </div>
    </div>
  );
}
