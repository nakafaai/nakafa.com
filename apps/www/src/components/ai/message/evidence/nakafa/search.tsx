"use client";

import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import type { NakafaDataPart } from "@repo/backend/confect/nina/contract/data";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr, Match, Option } from "effect";
import { useTranslations } from "use-intl";
import { nakafaIcons } from "@/components/ai/message/evidence/nakafa/icons";
import { Rows } from "@/components/ai/message/evidence/rows";
import { Step } from "@/components/ai/message/evidence/step";

interface Props {
  message: Extract<NakafaDataPart, { kind: "search"; status: "done" }>;
}

/** Renders Nakafa search results with a bounded default list. */
export function SearchPart({ message }: Props) {
  const t = useTranslations("Ai");
  const hasItems = message.result.items.length > 0;

  return (
    <Step icon={nakafaIcons.search} label={getSearchLabel(message, t)}>
      <SearchPartQueries message={message} />
      {hasItems ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Rows>
            {Arr.map(message.result.items, (item) => (
              <Button
                className="h-auto min-h-8 max-w-full whitespace-normal py-1 text-start"
                key={item.content_id}
                nativeButton={false}
                render={
                  <a
                    className="min-w-0"
                    href={item.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <span className="wrap-anywhere line-clamp-2 min-w-0 py-0.5">
                      {item.title}
                    </span>
                    <HugeIcons icon={ArrowUpRight01Icon} />
                  </a>
                }
                size="sm"
                variant="outline"
              />
            ))}
          </Rows>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          {t("nakafa-search-empty")}
        </p>
      )}
    </Step>
  );
}
SearchPart.displayName = "SearchPart";

function SearchPartQueries({ message }: Props) {
  const queries = Arr.dedupe(
    Arr.flatMap(message.input.queries ?? [], (query) => {
      const text = query.trim();

      if (!text) {
        return [];
      }

      return [text];
    })
  );

  if (queries.length === 0) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      {Arr.map(queries, (query) => (
        <SearchQueryText key={query} query={query} />
      ))}
    </div>
  );
}
SearchPartQueries.displayName = "SearchPartQueries";

/** A query shows two lines at most; the rest is cut with an ellipsis. */
function SearchQueryText({ query }: { query: string }) {
  return (
    <p
      className="wrap-anywhere line-clamp-2 py-0.5 text-muted-foreground text-sm"
      dir="auto"
    >{`"${query}"`}</p>
  );
}

/** Returns the clearest visible label for the current search result section. */
function getSearchLabel(
  message: Props["message"],
  t: ReturnType<typeof useTranslations>
) {
  const firstSection = Option.map(
    Arr.head(message.result.items),
    (item) => item.section
  );
  const section = message.input.section ?? Option.getOrUndefined(firstSection);

  return Match.value(section).pipe(
    Match.when("articles", () => t("nakafa-search-articles")),
    Match.when("material", () => t("nakafa-search-subject")),
    Match.when("tryout", () => t("nakafa-search-tryout")),
    Match.when("quran", () => t("nakafa-search-quran")),
    Match.orElse(() => t("nakafa-search-results"))
  );
}
