"use client";

import {
  NumberFormat,
  NumberFormatGroup,
} from "@repo/design-system/components/ui/number-flow";
import { Array as Arr } from "effect";
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
    <section className="flex flex-col items-center gap-3 rounded-xl border bg-card p-5 shadow-sm [--number-flow-mask-height:0.125em]">
      <NumberFormatGroup>
        <div className="items-baseline-last flex justify-center gap-2 sm:gap-3">
          {Arr.map(segments, (segment, index) => (
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
