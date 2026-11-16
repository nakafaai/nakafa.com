import { formatAge } from "@repo/internationalization/src/formats";
import { useFormatter, useLocale, useTranslations } from "use-intl";
import type { Memory } from "@/components/user/settings/memory/list";
import { useMemoryNow } from "@/components/user/settings/memory/provider";

/**
 * Says on which day a situation ends: "Ends October 20, 2026". The server
 * stores the end of the day the learner named in UTC, so the day is read as a
 * calendar day: in any other zone it could land on the day before or after.
 */
export function MemoryEnds({ validUntil }: { validUntil: number }) {
  const t = useTranslations("Memory");
  const format = useFormatter();

  return t("ends", { date: format.dateTime(validUntil, "calendarLong") });
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
  const time = formatAge(memory.confirmedAt, now, locale);

  return memory.author === "learner"
    ? t("written-by-you", { time })
    : t("saved-by-nina", { time });
}
