import {
  NumberFormat,
  NumberFormatGroup,
} from "@repo/design-system/components/ui/number-flow";
import { Array as Arr } from "effect";
import { Fragment } from "react";
import { useTranslations } from "use-intl";
import { useTryoutClock } from "@/components/tryout/runtime/clock";
import { readDeadlineParts } from "@/components/tryout/runtime/deadline";

/** The short label of each unit a deadline reads in. */
const UNIT_LABELS = {
  days: "time-days-short",
  hours: "time-hours-short",
  minutes: "time-minutes-short",
  seconds: "time-seconds-short",
} as const;

/** Displays an attempt deadline as the first overview card, in days while a day or more is left. */
export function TryoutCountdown({ expiresAt }: { expiresAt: number }) {
  const tTryouts = useTranslations("Tryouts");
  const now = useTryoutClock(true);
  const segments = Arr.map(
    readDeadlineParts(Math.ceil((expiresAt - now) / 1000)),
    ({ unit, value }) => ({ label: tTryouts(UNIT_LABELS[unit]), value })
  );
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
