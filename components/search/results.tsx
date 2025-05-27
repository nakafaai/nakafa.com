"use client";

import { getErrorMessage, usePagefind } from "@/lib/context/use-pagefind";
import { searchParsers } from "@/lib/nuqs/search";
import { useSearchQuery } from "@/lib/react-query/use-search";
import { cn } from "@/lib/utils";
import { getAnchorStyle } from "@/lib/utils/search";
import { IconMenu3 } from "@tabler/icons-react";
import {
  FileTextIcon,
  HeartCrackIcon,
  InfoIcon,
  RocketIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useQueryStates } from "nuqs";
import { Fragment } from "react";
import { useDebounceValue } from "usehooks-ts";
import { SpinnerIcon } from "../ui/icons";
import { Separator } from "../ui/separator";

export function SearchResults() {
  const t = useTranslations("Utils");

  const pagefindError = usePagefind((context) => context.error);

  const [{ q }] = useQueryStates(searchParsers);

  const [debouncedQuery] = useDebounceValue(q, 300);

  const {
    data: results = [],
    isError,
    error,
    isLoading,
    isPlaceholderData,
  } = useSearchQuery({
    query: debouncedQuery,
    enabled: !!debouncedQuery,
  });

  const hasError = isError || !!pagefindError;
  const displayError = pagefindError || (error ? getErrorMessage(error) : "");
  const queryLoading = isLoading && !hasError && !isPlaceholderData;

  if (hasError) {
    return (
      <div className="flex items-center justify-center gap-1 text-muted-foreground text-sm">
        <InfoIcon className="size-4" />
        <div className="mt-1">{t("search-error")}</div>
        {typeof displayError === "string" ||
        typeof displayError === "object" ? (
          <div className="mt-2 max-w-xs break-words text-xs">
            {displayError}
          </div>
        ) : null}
      </div>
    );
  }

  if (!debouncedQuery) {
    return (
      <div className="flex items-center justify-center gap-1 text-muted-foreground text-sm">
        <RocketIcon className="size-4" />
        <p>{t("search-help")}</p>
      </div>
    );
  }

  if (queryLoading) {
    return (
      <div className="flex items-center justify-center gap-1 text-muted-foreground text-sm">
        <SpinnerIcon className="size-4" />
        <p>{t("search-loading")}</p>
      </div>
    );
  }

  if (results.length === 0 && debouncedQuery) {
    return (
      <div className="flex items-center justify-center gap-1 text-muted-foreground text-sm">
        <HeartCrackIcon className="size-4" />
        <p>{t("search-not-found")}</p>
      </div>
    );
  }

  return results.map((result, index) => {
    const visibleSubResults = result.sub_results.filter(
      (subResult) => subResult.title !== result.meta.title
    );

    if (visibleSubResults.length === 0) {
      return null;
    }

    return (
      <Fragment key={result.url}>
        <div className="space-y-2">
          <h2 className="px-2 font-medium text-muted-foreground text-sm leading-tight">
            {result.meta.title}
          </h2>
          <div className="flex flex-col gap-1">
            {visibleSubResults.map((subResult) => (
              <Link
                prefetch
                href={subResult.url}
                key={subResult.url}
                className={cn(
                  getAnchorStyle(subResult.anchor),
                  "group flex items-center gap-2 rounded-sm p-2 transition-colors hover:bg-accent hover:text-accent-foreground"
                )}
                title={subResult.title}
              >
                {subResult.anchor?.element === "h2" ? (
                  <FileTextIcon className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-accent-foreground" />
                ) : (
                  <IconMenu3 className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-accent-foreground" />
                )}
                <span className="line-clamp-1">{subResult.title}</span>
              </Link>
            ))}
          </div>
        </div>
        {index !== results.length - 1 && <Separator className="my-2" />}
      </Fragment>
    );
  });
}
