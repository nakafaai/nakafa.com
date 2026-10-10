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
        <WebSearchPartQueries queries={message.queries} />
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
        <div className="ms-2 flex flex-col gap-3 border-s ps-4">
          <WebSearchPartQueries queries={message.queries} />
        </div>
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
      {/* The line starts under the row's icon, so the queries and sources read as its children. */}
      <div className="ms-2 flex flex-col gap-3 border-s ps-4">
        <WebSearchPartQueries queries={message.queries} />
        <WebSearchPartPreview
          emptyLabel={t("web-search-empty")}
          results={results}
        />
      </div>
    </div>
  );
}
WebSearchPart.displayName = "WebSearchPart";

function WebSearchPartQueries({ queries }: { queries: string[] }) {
  if (queries.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      {Arr.map(queries, (query) => (
        <WebSearchQueryText key={query} query={query} />
      ))}
    </div>
  );
}
WebSearchPartQueries.displayName = "WebSearchPartQueries";

function WebSearchQueryText({ query }: { query: string }) {
  return <p className="text-muted-foreground text-sm">{`"${query}"`}</p>;
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
    <div className="flex flex-wrap items-center gap-2">
      {Arr.map(results, (item) => (
        <Source href={item.url} key={item.url}>
          <SourceTrigger showFavicon />
          <SourceContent description={item.description} title={item.title} />
        </Source>
      ))}
    </div>
  );
}
WebSearchPartPreview.displayName = "WebSearchPartPreview";
