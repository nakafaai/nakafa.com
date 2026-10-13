"use client";

import { Option } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { factsLine } from "@/components/user/settings/memory/line";
import type { Memory } from "@/components/user/settings/memory/list";
import { useMemoryNow } from "@/components/user/settings/memory/provider";
import {
  formatConfirmed,
  formatEnds,
} from "@/components/user/settings/memory/time";

/**
 * Says in one line when a situation ends, who wrote a memory and when it was
 * last confirmed: "Ends October 20, 2026 · Saved by Nina · 2 days ago". The
 * time counts from the moment the server read the page, so the server and the
 * browser render the same words.
 */
export function MemoryFacts({ memory }: { memory: Memory }) {
  const t = useTranslations("Memory");
  const locale = useLocale();
  const now = useMemoryNow();

  return factsLine({
    confirmed: formatConfirmed(memory.confirmedAt, now, locale),
    ends: Option.map(Option.fromUndefinedOr(memory.validUntil), (validUntil) =>
      t("ends", { date: formatEnds(validUntil, locale) })
    ),
    origin:
      memory.author === "learner" ? t("written-by-you") : t("saved-by-nina"),
  });
}
