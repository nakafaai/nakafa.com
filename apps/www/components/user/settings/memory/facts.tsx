"use client";

import { Array as Arr } from "effect";
import { useLocale, useTranslations } from "next-intl";
import type { Memory } from "@/components/user/settings/memory/list";
import { useMemoryNow } from "@/components/user/settings/memory/provider";
import {
  formatConfirmed,
  formatEnds,
} from "@/components/user/settings/memory/time";

/**
 * Says in one line where a memory came from, when it was last confirmed and,
 * for a situation, when it ends: "From 3 chats · 2 days ago". The time counts
 * from the moment the server read the page, so the server and the browser
 * render the same words.
 */
export function MemoryFacts({ memory }: { memory: Memory }) {
  const t = useTranslations("Memory");
  const locale = useLocale();
  const now = useMemoryNow();
  const origin =
    memory.author === "learner"
      ? t("written-by-you")
      : t("from-chats", { count: memory.sources });

  return Arr.join(
    Arr.appendAll(
      [origin, formatConfirmed(memory.confirmedAt, now, locale)],
      memory.validUntil === undefined
        ? []
        : [t("ends", { date: formatEnds(memory.validUntil, locale) })]
    ),
    " · "
  );
}
