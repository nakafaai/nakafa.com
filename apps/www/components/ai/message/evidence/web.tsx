"use client";

import { AlertCircleIcon, Search01Icon } from "@hugeicons/core-free-icons";
import type { DataPart } from "@repo/backend/confect/nina/contract/data";
import {
  Source,
  SourceContent,
  SourceTrigger,
} from "@repo/design-system/components/ai/source";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Step } from "@/components/ai/message/evidence/step";

interface Props {
  message: DataPart["web-search"];
}

/**
 * One web search: its step, then its queries, the sites it was limited to and
 * what it found. A search that runs shows its own icon, because the activity
 * above it already turns.
 */
export function WebSearchPart({ message }: Props) {
  const t = useTranslations("Ai");

  if (message.status === "loading") {
    return (
      <Step icon={Search01Icon} label={t("web-search-loading")}>
        <WebSearchPartQueries queries={message.queries}>
          <WebSearchPartSites sites={message.sites} />
        </WebSearchPartQueries>
      </Step>
    );
  }

  if (message.status === "error") {
    return (
      <Step failed icon={AlertCircleIcon} label={t("web-search-error")}>
        <WebSearchPartQueries queries={message.queries}>
          <WebSearchPartSites sites={message.sites} />
        </WebSearchPartQueries>
      </Step>
    );
  }

  return (
    <Step icon={Search01Icon} label={t("web-search")}>
      <WebSearchPartQueries queries={message.queries}>
        <WebSearchPartSites sites={message.sites} />
      </WebSearchPartQueries>
      <WebSearchPartPreview
        emptyLabel={t("web-search-empty")}
        results={message.sources}
      />
    </Step>
  );
}
WebSearchPart.displayName = "WebSearchPart";

function WebSearchPartQueries({
  children,
  queries,
}: {
  children: ReactNode;
  queries: string[];
}) {
  if (queries.length === 0) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      {Arr.map(queries, (query) => (
        <WebSearchQueryText key={query} query={query} />
      ))}
      {children}
    </div>
  );
}
WebSearchPartQueries.displayName = "WebSearchPartQueries";

/**
 * The sites a search was limited to, under its query, so results of one site,
 * or none at all, read as what they are. They are plain hostnames in muted
 * text, with no count and no badge, one line each: a hostname longer than the
 * line ends in an ellipsis. A search that was open, and an answer stored
 * before the field existed, have none.
 */
function WebSearchPartSites({
  sites,
}: {
  sites: DataPart["web-search"]["sites"];
}) {
  if (sites === undefined || sites.length === 0) {
    return null;
  }

  return (
    <p
      className="flex min-w-0 flex-wrap gap-x-2 text-muted-foreground text-xs"
      data-slot="web-search-sites"
    >
      {Arr.map(Arr.dedupe(sites), (site) => (
        <span className="min-w-0 max-w-full truncate" key={site}>
          {site}
        </span>
      ))}
    </p>
  );
}
WebSearchPartSites.displayName = "WebSearchPartSites";

/** A query shows two lines at most; the rest is cut with an ellipsis. */
function WebSearchQueryText({ query }: { query: string }) {
  return (
    <p
      className="wrap-anywhere line-clamp-2 py-0.5 text-muted-foreground text-sm"
      dir="auto"
    >{`"${query}"`}</p>
  );
}

function WebSearchPartPreview({
  emptyLabel,
  results,
}: {
  emptyLabel: string;
  results: DataPart["web-search"]["sources"];
}) {
  if (results.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyLabel}</p>;
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {Arr.map(results, (item) => (
        <Source href={item.url} key={item.url}>
          <SourceTrigger title={item.title} />
          <SourceContent description={item.description} />
        </Source>
      ))}
    </div>
  );
}
WebSearchPartPreview.displayName = "WebSearchPartPreview";
