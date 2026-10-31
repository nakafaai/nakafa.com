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
        className="group/content focus-visible:ring-ring flex min-w-0 flex-col rounded-sm outline-none focus-visible:ring-2"
        href={url}
        rel="noopener noreferrer"
        target="_blank"
      >
        <span
          className="line-clamp-2 py-0.5 text-sm wrap-anywhere group-hover/content:underline group-focus-visible/content:underline"
          dir="auto"
        >
          {title}
        </span>
        {description ? (
          <span
            className="text-muted-foreground line-clamp-2 py-0.5 text-xs wrap-anywhere"
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
