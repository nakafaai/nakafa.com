"use client";

import {
  NumberFormat,
  NumberFormatGroup,
} from "@repo/design-system/components/ui/number-flow";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import { useTryoutClock } from "@/components/tryout/runtime/clock";

/** Displays an attempt deadline as the first overview card. */
export function TryoutCountdown({ expiresAt }: { expiresAt: number }) {
  const tTryouts = useTranslations("Tryouts");
  const now = useTryoutClock(true);
  const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  return (
    <section className="flex flex-col items-center gap-3 rounded-xl border bg-card p-5 shadow-sm">
      <TryoutTimer className="font-light text-5xl" seconds={seconds} />
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
        "inline-flex shrink-0 items-baseline font-mono text-sm tabular-nums",
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
