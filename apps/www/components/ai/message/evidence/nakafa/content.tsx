"use client";

import type { NakafaDataPart } from "@repo/backend/confect/nina/contract/data";
import { useTranslations } from "use-intl";
import { nakafaIcons } from "@/components/ai/message/evidence/nakafa/icons";
import { Step } from "@/components/ai/message/evidence/step";

interface Props {
  message: Extract<NakafaDataPart, { kind: "content"; status: "done" }>;
}

/**
 * One Nakafa page that Nina read: the step, and the page as a link under it,
 * its title in two lines at most and its description in two smaller ones.
 */
export function ContentPart({ message }: Props) {
  const t = useTranslations("Ai");
  const { description, title, url } = message.result;

  return (
    <Step icon={nakafaIcons.content} label={t("nakafa-content")}>
      <a
        className="group/content flex min-w-0 flex-col rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href={url}
        rel="noopener noreferrer"
        target="_blank"
      >
        <span
          className="wrap-anywhere line-clamp-2 py-0.5 text-sm group-hover/content:underline group-focus-visible/content:underline"
          dir="auto"
        >
          {title}
        </span>
        {description ? (
          <span
            className="wrap-anywhere line-clamp-2 py-0.5 text-muted-foreground text-xs"
            dir="auto"
          >
            {description}
          </span>
        ) : null}
      </a>
    </Step>
  );
}
ContentPart.displayName = "ContentPart";
