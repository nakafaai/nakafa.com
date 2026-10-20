import { AlertCircleIcon, FileSearchIcon } from "@hugeicons/core-free-icons";
import type { DataPart } from "@repo/backend/confect/nina/contract/data";
import {
  Source,
  SourceContent,
  SourceTrigger,
} from "@repo/design-system/components/ai/source";
import { useTranslations } from "use-intl";
import { Step } from "@/components/ai/message/evidence/step";

interface Props {
  message: DataPart["scrape-url"];
}

/**
 * Renders one inspected source URL used by the research agent. What happened
 * to the page is the step and the page is the row under it, so neither takes
 * the width of the other.
 */
export function ScrapeUrlPart({ message }: Props) {
  const t = useTranslations("Ai");

  if (message.status === "error") {
    return (
      <Step failed icon={AlertCircleIcon} label={t("scrape-error")}>
        <ScrapeUrlSource message={message} />
      </Step>
    );
  }

  return (
    <Step
      icon={FileSearchIcon}
      label={
        message.status === "loading" ? t("scrape-loading") : t("scrape-done")
      }
    >
      <ScrapeUrlSource message={message} />
    </Step>
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
