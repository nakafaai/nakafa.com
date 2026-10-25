import { AlertCircleIcon } from "@hugeicons/core-free-icons";
import type { NakafaDataPart } from "@repo/backend/confect/nina/contract/data";
import { Match } from "effect";
import { useTranslations } from "use-intl";
import { ContentPart } from "@/components/ai/message/evidence/nakafa/content";
import { nakafaIcons } from "@/components/ai/message/evidence/nakafa/icons";
import { QuranPart } from "@/components/ai/message/evidence/nakafa/quran";
import { SearchPart } from "@/components/ai/message/evidence/nakafa/search";
import { Step } from "@/components/ai/message/evidence/step";

interface Props {
  message: NakafaDataPart;
}

/** Renders one persisted Nakafa data envelope through its kind-specific UI. */
export function NakafaPart({ message }: Props) {
  const t = useTranslations("Ai");

  const kind = getKindLabel(message.kind, t);

  // A step that runs shows its own icon, because the activity above it already turns.
  if (message.status === "loading") {
    return (
      <Step
        icon={nakafaIcons[message.kind]}
        label={t("nakafa-loading", { kind })}
      />
    );
  }

  if (message.status === "error") {
    return (
      <Step failed icon={AlertCircleIcon} label={t("nakafa-error", { kind })} />
    );
  }

  return Match.value(message).pipe(
    Match.discriminators("kind")({
      taxonomy: () => (
        <Step icon={nakafaIcons.taxonomy} label={t("nakafa-taxonomy")} />
      ),
      search: (data) => <SearchPart message={data} />,
      content: (data) => <ContentPart message={data} />,
      quran: (data) => <QuranPart message={data} />,
    }),
    Match.exhaustive
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
    Match.exhaustive
  );
}
