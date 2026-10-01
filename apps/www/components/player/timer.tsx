"use client";

import { useTranslations } from "next-intl";
import { TryoutTimer } from "@/components/tryout/runtime/countdown";

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const LAST_MINUTE = 60;
const LAST_FIVE_MINUTES = 300;

/**
 * Shows the remaining time with digits that animate as they change. The name
 * stays silent while it counts; the status speaks once at five minutes and
 * once at one minute.
 */
export function PlayerTimer({ seconds }: { readonly seconds: number }) {
  const t = useTranslations("Player");
  let notice = "";
  if (seconds <= LAST_MINUTE) {
    notice = t("time-one");
  } else if (seconds <= LAST_FIVE_MINUTES) {
    notice = t("time-five");
  }
  return (
    <>
      <div
        aria-label={t("time-left", {
          hours: Math.floor(seconds / SECONDS_PER_HOUR),
          minutes: Math.floor(
            (seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE
          ),
          seconds: seconds % SECONDS_PER_MINUTE,
        })}
        className="shrink-0"
        role="timer"
      >
        <TryoutTimer seconds={seconds} />
      </div>
      <span className="sr-only" role="status">
        {notice}
      </span>
    </>
  );
}
