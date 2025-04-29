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
import { queryAtom, searchAtom } from "@/lib/jotai/search";
import { useSearch } from "@/lib/react-query/use-search";
import { cn } from "@/lib/utils";
import type { PagefindResult } from "@/types/pagefind";
import { IconMenu3 } from "@tabler/icons-react";
import { useAtom, useSetAtom } from "jotai";
import { HeartCrackIcon, InfoIcon, RocketIcon } from "lucide-react";
import { FileTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { addBasePath } from "next/dist/client/add-base-path";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useTransition } from "react";
import type { ReactElement } from "react";
import { useState } from "react";
import { useDebounceValue } from "usehooks-ts";
import { LoaderIcon } from "../ui/icons";

const DEV_SEARCH_NOTICE = (
  <>
    <p>
      Search isn&apos;t available in development because Nakafa uses Pagefind
      package, which indexes built `.html` files instead of `.md`/`.mdx`.
    </p>
    <p className="x:mt-2">
      To test search during development, run `next build` and then restart your
      app with `next dev`.
    </p>
  </>
);

// Fix React Compiler (BuildHIR::lowerExpression) Handle Import expressions
async function importPagefind() {
  try {
    window.pagefind = await import(
      /* webpackIgnore: true */ addBasePath("/_pagefind/pagefind.js")
    );
    window.pagefind?.options({
      baseUrl: "/",
      // ... more search options
    });
    await window.pagefind.init?.();
  } catch {
    window.pagefind = {
      debouncedSearch: () => Promise.resolve([]),
      destroy: () => Promise.resolve(),
      init: () => Promise.resolve(),
      options: () => undefined,
    };
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (
      process.env.NODE_ENV !== "production" &&
      error.message.includes("Failed to fetch")
    ) {
      return DEV_SEARCH_NOTICE; // This error will be tree-shaked in production
    }
    return `${error.constructor.name}: ${error.message}`;
  }
  return String(error);
}

export function SearchCommand() {
  const [open, setOpen] = useAtom(searchAtom);

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
  const [search, setSearch] = useAtom(queryAtom);

  return (
    <>
      <SearchInput value={search} onChange={setSearch} />
      <SearchList search={search} />
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
  const [isPagefindReady, setIsPagefindReady] = useState(false);
  const [pagefindError, setPagefindError] = useState<ReactElement | string>("");

  const [debouncedSearch] = useDebounceValue(search, 500);

  // Initialize Pagefind on mount
  useEffect(() => {
    const init = async () => {
      setPagefindError(""); // Reset error on attempt
      if (window.pagefind) {
        setIsPagefindReady(true);
        return;
      }
      try {
        await importPagefind();
        setIsPagefindReady(true);
      } catch (error: unknown) {
        setPagefindError(getErrorMessage(error));
        setIsPagefindReady(false); // Explicitly set to false on error
      }
    };
    init();
  }, []);

  const {
    data: results = [],
    isError,
    error,
    isLoading,
    isPlaceholderData,
  } = useSearch({
    query: debouncedSearch,
    enabled: isPagefindReady && !!debouncedSearch,
  });

  // Combine initialization error with query error
  const hasError = isError || !!pagefindError;
  const displayError = pagefindError || (error ? getErrorMessage(error) : "");

  return (
    <CommandList className="h-full max-h-[calc(100dvh-15rem)]">
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
  const setOpen = useSetAtom(searchAtom);
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

function getAnchorStyle(
  anchor: PagefindResult["sub_results"][number]["anchor"]
) {
  if (!anchor) {
    return null;
  }
  if (anchor.element === "h3") {
    return "ml-5";
  }
  if (anchor.element === "h4") {
    return "ml-9";
  }
  if (anchor.element === "h5") {
    return "ml-13";
  }
  if (anchor.element === "h6") {
    return "ml-17";
  }
  return null;
}
