import { useLocale, useTranslations } from "use-intl";
import { formatShortAge } from "@/components/user/age";
import type { Memory } from "@/components/user/settings/memory/list";
import { useMemoryNow } from "@/components/user/settings/memory/provider";
import { formatEnds } from "@/components/user/settings/memory/time";

/** Says on which day a situation ends: "Ends October 20, 2026". */
export function MemoryEnds({ validUntil }: { validUntil: number }) {
  const t = useTranslations("Memory");
  const locale = useLocale();

  return t("ends", { date: formatEnds(validUntil, locale) });
}

/**
 * Says who wrote a memory and when it was last confirmed: "Saved by Nina 2d
 * ago". The time counts from the moment the server read the page, so the
 * server and the browser render the same words.
 */
export function MemoryOrigin({ memory }: { memory: Memory }) {
  const t = useTranslations("Memory");
  const locale = useLocale();
  const now = useMemoryNow();
  const time = formatShortAge(memory.confirmedAt, now, locale);

  return memory.author === "learner"
    ? t("written-by-you", { time })
    : t("saved-by-nina", { time });
}
