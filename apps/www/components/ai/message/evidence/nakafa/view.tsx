"use client";

import { BookOpen02Icon, Sad02Icon } from "@hugeicons/core-free-icons";
import type { NakafaDataPart } from "@repo/backend/confect/nina/contract/data";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { Match } from "effect";
import { useTranslations } from "next-intl";

import { ContentPart } from "@/components/ai/message/evidence/nakafa/content";
import { QuranPart } from "@/components/ai/message/evidence/nakafa/quran";
import { SearchPart } from "@/components/ai/message/evidence/nakafa/search";

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

  return Match.value(message).pipe(
    Match.discriminators("kind")({
      taxonomy: () => (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <HugeIcons className="size-4 shrink-0" icon={BookOpen02Icon} />
          <span>{t("nakafa-taxonomy")}</span>
        </div>
      ),
      search: (data) => <SearchPart message={data} />,
      content: (data) => <ContentPart message={data} />,
      quran: (data) => <QuranPart message={data} />,
    }),
    Match.orElse(() => null)
  );
}
NakafaPart.displayName = "NakafaPart";

/** Returns a localized label for one Nakafa data kind. */
function getKindLabel(
  kind: NakafaDataPart["kind"],
  t: ReturnType<typeof useTranslations>
) {
  return Match.value(kind).pipe(
    Match.when("search", () => t("nakafa-search")),
    Match.when("content", () => t("nakafa-content")),
    Match.when("quran", () => t("nakafa-quran")),
    Match.when("taxonomy", () => t("nakafa-taxonomy")),
    Match.orElse(() => t("nakafa"))
  );
}
