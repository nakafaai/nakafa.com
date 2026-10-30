import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import type { NakafaDataPart } from "@repo/backend/confect/nina/contract/data";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cn } from "cn";
import { useTranslations } from "use-intl";
import { nakafaIcons } from "@/components/ai/message/evidence/nakafa/icons";
import { Step } from "@/components/ai/message/evidence/step";

interface Props {
  message: Extract<NakafaDataPart, { kind: "quran"; status: "done" }>;
}

/**
 * Renders a compact Quran reference preview: the surah, and the verse or the
 * verses of it. The numbers are what a learner compares, so they are never
 * cut: when they do not fit beside the name they take a line of their own in
 * the button, and the arrow follows them onto the next line before it would
 * cover them. Only a name longer than the whole button ends in an ellipsis.
 */
export function QuranPart({ message }: Props) {
  const t = useTranslations("Ai");
  const { from_verse: from, name, to_verse: to, url } = message.result;

  return (
    <Step icon={nakafaIcons.quran} label={t("nakafa-quran")}>
      <a
        className={cn(
          buttonVariants({
            className:
              "h-auto min-h-8 min-w-0 max-w-full self-start whitespace-normal py-1 text-start",
            size: "sm",
            variant: "outline",
          })
        )}
        href={url}
        rel="noopener noreferrer"
        target="_blank"
      >
        <span className="flex min-w-0 flex-wrap items-center">
          <span className="min-w-0 max-w-full truncate">{name}</span>
          <span className="shrink-0">
            : {from === to ? from : `${from}-${to}`}
          </span>
          <HugeIcons className="ms-1.5" icon={ArrowUpRight01Icon} />
        </span>
      </a>
    </Step>
  );
}
QuranPart.displayName = "QuranPart";
