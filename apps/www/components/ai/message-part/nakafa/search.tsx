"use client";

import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  ArrowUpRight01Icon,
  Search02Icon,
} from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import type { NakafaDataPart } from "@repo/ai/schema/data";
import { readPracticeSourceRouteByPath } from "@repo/contents/_types/route/practice/identity";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";

const MAX_SHOWN_RESULTS = 5;

interface Props {
  message: Extract<NakafaDataPart, { kind: "search"; status: "done" }>;
}

/** Renders Nakafa search results with a bounded default list. */
export const SearchPart = ({ message }: Props) => {
  const t = useTranslations("Ai");
  const [expanded, { toggle }] = useDisclosure(false);
  const items = expanded
    ? message.result.items
    : message.result.items.slice(0, MAX_SHOWN_RESULTS);
  const hasItems = items.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <HugeIcons
          className="size-4 text-muted-foreground"
          icon={Search02Icon}
        />
        <span className="text-muted-foreground text-sm">
          {getSearchLabel(message, t)}
        </span>
        <Badge variant="muted">{message.result.count}</Badge>
      </div>
      <SearchPartQueries message={message} />
      {hasItems ? (
        <div className="flex flex-wrap items-center gap-2">
          {items.map((item) => (
            <Button
              className="max-w-full"
              key={item.content_id}
              nativeButton={false}
              render={
                <a
                  className="min-w-0"
                  href={item.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <span className="truncate">{item.title}</span>
                  <HugeIcons icon={ArrowUpRight01Icon} />
                </a>
              }
              size="sm"
              variant="outline"
            />
          ))}
          {message.result.items.length > MAX_SHOWN_RESULTS ? (
            <Button onClick={toggle} size="sm" variant="outline">
              {expanded ? t("show-less") : t("show-more")}
              <HugeIcons icon={expanded ? ArrowUp01Icon : ArrowDown01Icon} />
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          {t("nakafa-search-empty")}
        </p>
      )}
    </div>
  );
};
SearchPart.displayName = "SearchPart";

const SearchPartQueries = ({ message }: Props) => {
  const queries = Array.from(
    new Set(
      (message.input.queries ?? []).flatMap((query) => {
        const text = query.trim();

        if (!text) {
          return [];
        }

        return [text];
      })
    )
  );

  if (queries.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      {queries.map((query) => (
        <SearchQueryText key={query} query={query} />
      ))}
    </div>
  );
};
SearchPartQueries.displayName = "SearchPartQueries";

function SearchQueryText({ query }: { query: string }) {
  return <p className="text-muted-foreground text-sm">{`"${query}"`}</p>;
}

/** Returns the clearest visible label for the current search result section. */
function getSearchLabel(
  message: Props["message"],
  t: ReturnType<typeof useTranslations>
) {
  const firstItem = message.result.items.at(0);
  const section = message.input.section ?? firstItem?.section;

  switch (section) {
    case "articles":
      return t("nakafa-search-articles");
    case "material":
      if (
        firstItem &&
        readPracticeSourceRouteByPath({
          locale: firstItem.locale,
          route: firstItem.route,
        })
      ) {
        return t("nakafa-search-exercises");
      }

      return t("nakafa-search-subject");
    case "quran":
      return t("nakafa-search-quran");
    default:
      return t("nakafa-search-results");
  }
}
