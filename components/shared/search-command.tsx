"use client";

import { searchAtom } from "@/lib/jotai/search";
import type { PagefindResult, PagefindSearchOptions } from "@/types/pagefind";
import { useAtom } from "jotai";
import { HeartCrackIcon, InfoIcon, RocketIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { addBasePath } from "next/dist/client/add-base-path";
import { useDeferredValue, useEffect } from "react";
import type { ReactElement, ReactNode } from "react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { LoaderIcon } from "../ui/icons";
import { ScrollArea } from "../ui/scroll-area";
import { SearchResults } from "./search-results";

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
    await window.pagefind.init();
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

function ContentContainer({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-1 p-8 text-muted-foreground text-sm">
      {children}
    </div>
  );
}

function Content({
  isLoading,
  error,
  results,
  search,
}: {
  isLoading: boolean;
  error: ReactElement | string;
  results: PagefindResult[];
  search: string;
}) {
  const t = useTranslations("Utils");

  if (error) {
    return (
      <ContentContainer>
        <InfoIcon className="size-4" />
        <p>{t("search-error")}</p>
      </ContentContainer>
    );
  }

  if (!search) {
    return (
      <ContentContainer>
        <RocketIcon className="size-4" />
        <p>{t("search-help")}</p>
      </ContentContainer>
    );
  }

  if (results.length) {
    return results.map((result) => (
      <SearchResults key={result.url} data={result} />
    ));
  }

  if (isLoading) {
    return (
      <ContentContainer>
        <LoaderIcon />
        <p>{t("search-loading")}</p>
      </ContentContainer>
    );
  }

  return (
    <ContentContainer>
      <HeartCrackIcon className="size-4" />
      <p>{t("search-not-found")}</p>
    </ContentContainer>
  );
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent hideClose className="gap-0 p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{t("search")}</DialogTitle>
          <DialogDescription>{t("search-help")}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 border-b px-4">
          <SearchIcon className="size-4 shrink-0 opacity-50" />
          <input
            placeholder={t("search-placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="h-12 w-full flex-1 rounded-md bg-transparent text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <ScrollArea className="max-h-[calc(100dvh-15rem)] sm:max-h-[calc(100dvh-20rem)]">
          <Content
            isLoading={isLoading}
            error={error}
            results={results}
            search={deferredSearch}
          />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
