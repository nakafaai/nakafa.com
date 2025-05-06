"use client";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { getErrorMessage, usePagefind } from "@/lib/context/use-pagefind";
import { useSearch } from "@/lib/react-query/use-search";
import { useSearchStore } from "@/lib/store/search";
import { cn } from "@/lib/utils";
import { getAnchorStyle } from "@/lib/utils/search";
import type { PagefindResult } from "@/types/pagefind";
import { IconMenu3 } from "@tabler/icons-react";
import { HeartCrackIcon, InfoIcon, RocketIcon } from "lucide-react";
import { FileTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useTransition } from "react";
import type { ReactElement } from "react";
import { useDebounceValue } from "usehooks-ts";
import { LoaderIcon } from "../ui/icons";

export function SearchCommand() {
  const open = useSearchStore((state) => state.open);
  const setOpen = useSearchStore((state) => state.setOpen);

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
        setOpen(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [setOpen]);

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
    </CommandDialog>
  );
}

function SearchMain() {
  const query = useSearchStore((state) => state.query);
  const setQuery = useSearchStore((state) => state.setQuery);

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

  const [debouncedSearch] = useDebounceValue(search, 300);

  const {
    data: results = [],
    isError,
    error,
    isLoading,
    isPlaceholderData,
  } = useSearch({
    query: debouncedSearch,
    enabled: !!debouncedSearch,
  });

  // Combine initialization error with query error
  const hasError = isError || !!pagefindError;
  const displayError = pagefindError || (error ? getErrorMessage(error) : "");

  return (
    <CommandList className="h-full sm:max-h-[500px]">
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
  const setOpen = useSearchStore((state) => state.setOpen);
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
    return (
      <CommandEmpty className="flex items-center justify-center gap-1 p-7.5 text-muted-foreground text-sm">
        <RocketIcon className="size-4" />
        <p>{t("search-help")}</p>
      </CommandEmpty>
    );
  }

  if (isLoading) {
    return (
      <CommandEmpty className="flex items-center justify-center gap-1 p-7.5 text-muted-foreground text-sm">
        <LoaderIcon />
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

  return results.map((result, index) => {
    // Filter out sub_results with titles matching the meta title
    const visibleSubResults = result.sub_results.filter(
      (subResult) => subResult.title !== result.meta.title
    );

    // If there are no visible sub_results, don't render the group
    if (visibleSubResults.length === 0) {
      return null;
    }

    return (
      <Fragment key={result.url}>
        <CommandGroup heading={result.meta.title}>
          {visibleSubResults.map((subResult) => (
            <CommandItem
              key={subResult.url}
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
    );
  });
}
