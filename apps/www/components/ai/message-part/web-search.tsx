"use client";

import { AiWebBrowsingIcon, Sad02Icon } from "@hugeicons/core-free-icons";
import type { DataPart } from "@repo/ai/schema/data-parts";
import {
  Source,
  SourceContent,
  SourceTrigger,
} from "@repo/design-system/components/ai/source";
import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useTranslations } from "next-intl";
import { memo } from "react";

interface Props {
  message: DataPart["web-search"];
}

export const WebSearchPart = memo(({ message }: Props) => {
  const t = useTranslations("Ai");

  const isLoading = message.status === "loading";
  const isError = message.status === "error";

  const results = message.sources;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Spinner className="size-4 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">
          {t("web-search-loading")}
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2">
        <HugeIcons className="size-4 text-destructive" icon={Sad02Icon} />
        <span className="text-muted-foreground text-sm">
          {t("web-search-error")}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <HugeIcons
          className="size-4 text-muted-foreground"
          icon={AiWebBrowsingIcon}
        />
        <span className="text-muted-foreground text-sm">{t("web-search")}</span>
        <Badge variant="muted">{results.length}</Badge>
      </div>
      <WebSearchPartPreview results={results} />
    </div>
  );
});
WebSearchPart.displayName = "WebSearchPart";

const WebSearchPartPreview = memo(
  ({ results }: { results: DataPart["web-search"]["sources"] }) => {
    if (results.length === 0) {
      return null;
    }

    return (
      <div className="flex flex-wrap items-center gap-2">
        {results.map((item, index) => (
          <Source href={item.url} key={`${item.url}-${index}`}>
            <SourceTrigger showFavicon />
            <SourceContent description={item.description} title={item.title} />
          </Source>
        ))}
      </div>
    );
  }
);
WebSearchPartPreview.displayName = "WebSearchPartPreview";
