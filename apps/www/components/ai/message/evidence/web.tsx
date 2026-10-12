"use client";

import { Sad02Icon, Search01Icon } from "@hugeicons/core-free-icons";
import type { DataPart } from "@repo/backend/confect/nina/contract/data";
import {
  Source,
  SourceContent,
  SourceTrigger,
} from "@repo/design-system/components/ai/source";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";

interface Props {
  message: DataPart["web-search"];
}

export function WebSearchPart({ message }: Props) {
  const t = useTranslations("Ai");

  const isLoading = message.status === "loading";
  const isError = message.status === "error";

  const results = message.sources;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Spinner className="size-4 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">
            {t("web-search-loading")}
          </p>
        </div>
        <WebSearchPartQueries queries={message.queries} sites={message.sites} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-destructive text-sm">
          <HugeIcons className="size-4 shrink-0" icon={Sad02Icon} />
          <span>{t("web-search-error")}</span>
        </div>
        <WebSearchPartQueries queries={message.queries} sites={message.sites} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <HugeIcons
          className="size-4 text-muted-foreground"
          icon={Search01Icon}
        />
        <span className="text-muted-foreground text-sm">{t("web-search")}</span>
      </div>
      <WebSearchPartQueries queries={message.queries} sites={message.sites} />
      <WebSearchPartPreview
        emptyLabel={t("web-search-empty")}
        results={results}
      />
    </div>
  );
}
WebSearchPart.displayName = "WebSearchPart";

function WebSearchPartQueries({
  queries,
  sites,
}: {
  queries: string[];
  sites: DataPart["web-search"]["sites"];
}) {
  if (queries.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      {Arr.map(queries, (query) => (
        <WebSearchQueryText key={query} query={query} />
      ))}
      <WebSearchPartSites sites={sites} />
    </div>
  );
}
WebSearchPartQueries.displayName = "WebSearchPartQueries";

/**
 * The sites a search was limited to, under its query, so results of one site,
 * or none at all, read as what they are. They are plain hostnames in muted
 * text, with no count and no badge. A search that was open, and an answer
 * stored before the field existed, have none. Each hostname wraps wherever it
 * must, so a long one keeps both of its ends on the screen.
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
      className="flex flex-wrap gap-x-2 text-muted-foreground text-xs"
      data-slot="web-search-sites"
    >
      {Arr.map(Arr.dedupe(sites), (site) => (
        <span className="wrap-anywhere" key={site}>
          {site}
        </span>
      ))}
    </p>
  );
}
WebSearchPartSites.displayName = "WebSearchPartSites";

function WebSearchQueryText({ query }: { query: string }) {
  return (
    <p className="text-muted-foreground text-sm" dir="auto">{`"${query}"`}</p>
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
    <div className="flex flex-col gap-2">
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
