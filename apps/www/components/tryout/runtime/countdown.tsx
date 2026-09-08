"use client";

import {
  NumberFormat,
  NumberFormatGroup,
} from "@repo/design-system/components/ui/number-flow";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import { Fragment } from "react";
import { useTryoutClock } from "@/components/tryout/runtime/clock";

/** Displays an attempt deadline as the first overview card. */
export function TryoutCountdown({ expiresAt }: { expiresAt: number }) {
  const tTryouts = useTranslations("Tryouts");
  const now = useTryoutClock(true);
  const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const segments = [
    { label: tTryouts("time-hours-short"), value: Math.floor(seconds / 3600) },
    {
      label: tTryouts("time-minutes-short"),
      value: Math.floor((seconds % 3600) / 60),
    },
    { label: tTryouts("time-seconds-short"), value: seconds % 60 },
  ];
  return (
    <section className="flex flex-col items-center gap-3 rounded-xl border bg-card p-5 shadow-sm">
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
                    format={{ minimumIntegerDigits: 2, useGrouping: false }}
                    trend={-1}
                    value={segment.value}
                  />
                </span>
              </div>
              {index < segments.length - 1 && (
                <span className="pb-0.5 text-center align-middle font-light font-mono text-3xl text-muted-foreground leading-none">
                  :
                </span>
              )}
            </Fragment>
          ))}
        </div>
      </NumberFormatGroup>
      <p className="text-muted-foreground text-sm">
        {tTryouts("remaining-time-label")}
      </p>
    </section>
  );
}

/** Animates timer digits without changing the width at minute/hour rollover. */
export function TryoutTimer({
  className,
  seconds,
}: {
  className?: string;
  seconds: number;
}) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return (
    <time
      className={cn(
        "inline-flex shrink-0 items-baseline font-mono text-base tabular-nums",
        className
      )}
      dateTime={`PT${seconds}S`}
    >
      <NumberFormatGroup>
        <NumberFormat
          format={{ minimumIntegerDigits: 2, useGrouping: false }}
          trend={-1}
          value={hours}
        />
        <span className="text-muted-foreground">:</span>
        <NumberFormat
          digits={{ 1: { max: 5 } }}
          format={{ minimumIntegerDigits: 2 }}
          trend={-1}
          value={minutes}
        />
        <span className="text-muted-foreground">:</span>
        <NumberFormat
          digits={{ 1: { max: 5 } }}
          format={{ minimumIntegerDigits: 2 }}
          trend={-1}
          value={remainder}
        />
      </NumberFormatGroup>
    </time>
  );
}
