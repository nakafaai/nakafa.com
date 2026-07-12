"use client";

import {
  NumberFormat,
  NumberFormatGroup,
} from "@repo/design-system/components/ui/number-flow";
import { useTranslations } from "next-intl";
import { Fragment, type ReactNode } from "react";
import { useTryoutClock } from "@/components/tryout/runtime/clock";

const SECOND_MS = 1000;
const MINUTE_SECONDS = 60;
const HOUR_SECONDS = 3600;

/** Renders the production try-out set countdown card. */
export function TryoutCountdown({
  action,
  expiresAt,
}: {
  action: ReactNode;
  expiresAt: number;
}) {
  const tTryouts = useTranslations("Tryouts");
  const remainingSeconds = useCountdownSeconds(expiresAt);
  const segments = getCountdownSegments({
    hoursLabel: tTryouts("time-hours-short"),
    minutesLabel: tTryouts("time-minutes-short"),
    secondsLabel: tTryouts("time-seconds-short"),
    totalSeconds: remainingSeconds,
  });

  return (
    <section className="w-full rounded-xl border bg-card p-5 shadow-sm">
      <NumberFormatGroup>
        <div className="flex items-end justify-center gap-2 sm:gap-3">
          {segments.map((segment, index) => (
            <Fragment key={segment.label}>
              <div className="grid gap-1 text-center">
                <span className="text-muted-foreground text-xs uppercase tracking-wide">
                  {segment.label}
                </span>
                <span className="font-light font-mono text-5xl text-foreground tabular-nums leading-none tracking-tighter">
                  <NumberFormat
                    aria-label={segment.label}
                    digits={index === 0 ? undefined : { 1: { max: 5 } }}
                    format={{ minimumIntegerDigits: 2 }}
                    trend={-1}
                    value={segment.value}
                  />
                </span>
              </div>
              <TryoutCountdownSeparator visible={index < segments.length - 1} />
            </Fragment>
          ))}
        </div>
      </NumberFormatGroup>

      <p className="text-center text-muted-foreground text-sm">
        {tTryouts("remaining-time-label")}
      </p>

      <div className="flex justify-center pt-4">{action}</div>
    </section>
  );
}

/** Separates adjacent countdown segments without trailing punctuation. */
function TryoutCountdownSeparator({ visible }: { visible: boolean }) {
  if (!visible) {
    return null;
  }

  return (
    <span className="pb-0.5 text-center align-middle font-light font-mono text-3xl text-muted-foreground leading-none">
      :
    </span>
  );
}

/** Tracks remaining whole seconds for one Convex attempt expiry timestamp. */
function useCountdownSeconds(expiresAt: number) {
  const now = useTryoutClock(true);

  return Math.max(0, Math.ceil((expiresAt - now) / SECOND_MS));
}

/** Splits a total number of seconds into the visible countdown segments. */
function getCountdownSegments({
  hoursLabel,
  minutesLabel,
  secondsLabel,
  totalSeconds,
}: {
  hoursLabel: string;
  minutesLabel: string;
  secondsLabel: string;
  totalSeconds: number;
}) {
  const hours = Math.floor(totalSeconds / HOUR_SECONDS);
  const minutes = Math.floor((totalSeconds % HOUR_SECONDS) / MINUTE_SECONDS);
  const seconds = totalSeconds % MINUTE_SECONDS;

  return [
    { label: hoursLabel, value: hours },
    { label: minutesLabel, value: minutes },
    { label: secondsLabel, value: seconds },
  ] as const;
}
