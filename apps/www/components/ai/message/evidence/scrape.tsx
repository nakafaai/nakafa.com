"use client";

import { FileSearchIcon, Sad02Icon } from "@hugeicons/core-free-icons";
import type { DataPart } from "@repo/backend/confect/nina/contract/data";
import {
  Source,
  SourceContent,
  SourceTrigger,
} from "@repo/design-system/components/ai/source";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useTranslations } from "next-intl";

interface Props {
  message: DataPart["scrape-url"];
}

/**
 * Renders one inspected source URL used by the research agent. What happened
 * to the page is one line and the page is the row under it, so neither takes
 * the width of the other.
 */
export function ScrapeUrlPart({ message }: Props) {
  const t = useTranslations("Ai");

  if (message.status === "loading") {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Spinner className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground text-sm">
            {t("scrape-loading")}
          </span>
        </div>
        <ScrapeUrlSource message={message} />
      </div>
    );
  }

  if (message.status === "error") {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-destructive text-sm">
          <HugeIcons className="size-4 shrink-0" icon={Sad02Icon} />
          <span>{t("scrape-error")}</span>
        </div>
        <ScrapeUrlSource message={message} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <HugeIcons
          className="size-4 text-muted-foreground"
          icon={FileSearchIcon}
        />
        <span className="text-muted-foreground text-sm">
          {t("scrape-done")}
        </span>
      </div>
      <ScrapeUrlSource message={message} />
    </div>
  );
}
ScrapeUrlPart.displayName = "ScrapeUrlPart";

function ScrapeUrlSource({ message }: Props) {
  return (
    <Source href={message.url}>
      <SourceTrigger faviconUrl={message.favicon} title={message.title} />
      <SourceContent description={message.description} />
    </Source>
  );
}
ScrapeUrlSource.displayName = "ScrapeUrlSource";
