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
import { searchAtom } from "@/lib/jotai/search";
import { cn } from "@/lib/utils";
import type { PagefindResult, PagefindSearchOptions } from "@/types/pagefind";
import { IconMenu3 } from "@tabler/icons-react";
import { useAtom } from "jotai";
import { HeartCrackIcon, InfoIcon, RocketIcon } from "lucide-react";
import { FileTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { addBasePath } from "next/dist/client/add-base-path";
import { useRouter } from "next/navigation";
import { Fragment, useDeferredValue, useEffect, useTransition } from "react";
import type { ReactElement } from "react";
import { useState } from "react";
import { LoaderIcon } from "../ui/icons";

// Define regex patterns at top level for better performance
const HTML_EXT_REGEX = /\.html$/;
const HTML_ANCHOR_REGEX = /\.html#/;
const SEARCH_OPTIONS: PagefindSearchOptions = {};
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
  const t = useTranslations("Utils");

  const [open, setOpen] = useAtom(searchAtom);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ReactElement | string>("");
  const [results, setResults] = useState<PagefindResult[]>([]);
  const [search, setSearch] = useState("");
  // defer pagefind results update for prioritizing user input state
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    const getResults = async (value: string) => {
      const response = await window.pagefind.debouncedSearch<PagefindResult>(
        value,
        SEARCH_OPTIONS
      );
      if (!response) {
        return;
      }

      try {
        // @ts-expect-error: pagefind returns a promise of an array of objects
        const data = await Promise.all(response.results.map((o) => o.data()));

        setResults(
          data.map((newData: PagefindResult) => ({
            ...newData,
            sub_results: newData.sub_results.map((r) => {
              const url = r.url
                .replace(HTML_EXT_REGEX, "")
                .replace(HTML_ANCHOR_REGEX, "#");

              return { ...r, url };
            }),
          }))
        );
      } catch (error) {
        setError(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    };

    const handleSearch = async (value: string) => {
      if (!value) {
        setResults([]);
        setError("");
        return;
      }

      setIsLoading(true);

      if (!window.pagefind) {
        setError("");
        try {
          await importPagefind();
        } catch (error: unknown) {
          setError(getErrorMessage(error));
          setIsLoading(false);
          return;
        }
      }

      await getResults(value);
    };

    handleSearch(deferredSearch);
  }, [deferredSearch]);

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
      <CommandInput
        placeholder={t("search-placeholder")}
        value={search}
        onValueChange={setSearch}
        autoFocus
      />
      <CommandList className="h-full max-h-[calc(100dvh-15rem)]">
        <SearchResults
          error={error}
          deferredSearch={deferredSearch}
          isLoading={isLoading}
          results={results}
          setClose={() => setOpen(false)}
        />
      </CommandList>
    </CommandDialog>
  );
}

function SearchResults({
  error,
  deferredSearch,
  isLoading,
  results,
  setClose,
}: {
  error: ReactElement | string;
  deferredSearch: string;
  isLoading: boolean;
  results: PagefindResult[];
  setClose: () => void;
}) {
  const t = useTranslations("Utils");
  const router = useRouter();

  const [isPending, startTransition] = useTransition();

  if (error) {
    return (
      <CommandEmpty className="flex items-center justify-center gap-1 p-8 text-muted-foreground text-sm">
        <InfoIcon className="size-4" />
        <p>{t("search-error")}</p>
      </CommandEmpty>
    );
  }

  if (!deferredSearch) {
    return (
      <CommandEmpty className="flex items-center justify-center gap-1 p-8 text-muted-foreground text-sm">
        <RocketIcon className="size-4" />
        <p>{t("search-help")}</p>
      </CommandEmpty>
    );
  }

  if (isLoading && !results.length) {
    return (
      <CommandEmpty className="flex items-center justify-center gap-1 p-8 text-muted-foreground text-sm">
        <LoaderIcon />
        <p>{t("search-loading")}</p>
      </CommandEmpty>
    );
  }

  if (results.length === 0) {
    return (
      <CommandEmpty className="flex items-center justify-center gap-1 p-8 text-muted-foreground text-sm">
        <HeartCrackIcon className="size-4" />
        <p>{t("search-not-found")}</p>
      </CommandEmpty>
    );
  }

  // Render results
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
          {visibleSubResults.map((subResult) => {
            router.prefetch(subResult.url);
            return (
              <CommandItem
                key={subResult.url}
                value={`${result.meta.title} ${subResult.title} ${subResult.url}`}
                className={cn(
                  "cursor-pointer",
                  getAnchorStyle(subResult.anchor)
                )}
                onMouseEnter={() => router.prefetch(subResult.url)}
                onFocus={() => router.prefetch(subResult.url)}
                onSelect={() => {
                  startTransition(() => {
                    router.push(subResult.url);
                    setClose();
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
            );
          })}
        </CommandGroup>

        <CommandSeparator
          alwaysRender={index !== results.length - 1}
          className="my-2"
        />
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
