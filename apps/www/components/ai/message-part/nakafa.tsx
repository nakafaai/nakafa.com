"use client";

import { BookOpen02Icon, Sad02Icon } from "@hugeicons/core-free-icons";
import type { NakafaDataPart } from "@repo/backend/confect/nina/contract/data";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useTranslations } from "next-intl";

import { ContentPart } from "@/components/ai/message-part/nakafa/content";
import { QuranPart } from "@/components/ai/message-part/nakafa/quran";
import { SearchPart } from "@/components/ai/message-part/nakafa/search";

interface Props {
  message: NakafaDataPart;
}

/** Renders one persisted Nakafa data envelope through its kind-specific UI. */
export function NakafaPart({ message }: Props) {
  const t = useTranslations("Ai");

  const kind = getKindLabel(message.kind, t);

  if (message.status === "loading") {
    return (
      <div className="flex items-center gap-2">
        <Spinner className="size-4 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">
          {t("nakafa-loading", { kind })}
        </p>
      </div>
    );
  }

  if (message.status === "error") {
    return (
      <div className="flex items-center gap-2 text-destructive text-sm">
        <HugeIcons className="size-4 shrink-0" icon={Sad02Icon} />
        <span>{t("nakafa-error", { kind })}</span>
      </div>
    );
  }

  switch (message.kind) {
    case "taxonomy":
      return (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <HugeIcons className="size-4 shrink-0" icon={BookOpen02Icon} />
          <span>{t("nakafa-taxonomy")}</span>
        </div>
      );
    case "search":
      return <SearchPart message={message} />;
    case "content":
      return <ContentPart message={message} />;
    case "quran":
      return <QuranPart message={message} />;
    default:
      return null;
  }
}
NakafaPart.displayName = "NakafaPart";

/** Returns a localized label for one Nakafa data kind. */
function getKindLabel(
  kind: NakafaDataPart["kind"],
  t: ReturnType<typeof useTranslations>
) {
  switch (kind) {
    case "search":
      return t("nakafa-search");
    case "content":
      return t("nakafa-content");
    case "quran":
      return t("nakafa-quran");
    case "taxonomy":
      return t("nakafa-taxonomy");
    default:
      return t("nakafa");
  }
}
