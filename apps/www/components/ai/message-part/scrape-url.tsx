"use client";

import { FileSearchIcon, Sad02Icon } from "@hugeicons/core-free-icons";
import type { DataPart } from "@repo/ai/schema/data";
import {
  Source,
  SourceContent,
  SourceTrigger,
} from "@repo/design-system/components/ai/source";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useTranslations } from "next-intl";
import { memo } from "react";

interface Props {
  message: DataPart["scrape-url"];
}

/** Renders one inspected source URL used by the research agent. */
export const ScrapeUrlPart = memo(({ message }: Props) => {
  const t = useTranslations("Ai");

  if (message.status === "loading") {
    return (
      <div className="flex items-center gap-2">
        <Spinner className="size-4 text-muted-foreground" />
        <span className="text-muted-foreground text-sm">
          {t("scrape-loading")}
        </span>
        <ScrapeUrlSource message={message} />
      </div>
    );
  }

  if (message.status === "error") {
    return (
      <div className="flex items-center gap-2">
        <HugeIcons className="size-4 text-destructive" icon={Sad02Icon} />
        <span className="text-muted-foreground text-sm">
          {t("scrape-error")}
        </span>
        <ScrapeUrlSource message={message} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <HugeIcons
        className="size-4 text-muted-foreground"
        icon={FileSearchIcon}
      />
      <span className="text-muted-foreground text-sm">{t("scrape-done")}</span>
      <ScrapeUrlSource message={message} />
    </div>
  );
});
ScrapeUrlPart.displayName = "ScrapeUrlPart";

const ScrapeUrlSource = memo(({ message }: Props) => (
  <Source href={message.url}>
    <SourceTrigger faviconUrl={message.favicon} showFavicon />
    <SourceContent
      description={message.description}
      faviconUrl={message.favicon}
      title={getSourceTitle(message)}
    />
  </Source>
));
ScrapeUrlSource.displayName = "ScrapeUrlSource";

/** Returns a compact source title for hover content. */
function getSourceTitle(message: DataPart["scrape-url"]) {
  const title = message.title?.trim();

  if (title) {
    return title;
  }

  const { url } = message;

  if (typeof URL.canParse === "function" && URL.canParse(url)) {
    return new URL(url).hostname.replace("www.", "");
  }

  return url;
}
