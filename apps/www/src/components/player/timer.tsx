import {
  NumberFormat,
  NumberFormatGroup,
} from "@repo/design-system/components/ui/number-flow";
import { cva, type VariantProps } from "class-variance-authority";
import { useTranslations } from "use-intl";
import { readTimeNotice, splitTime } from "@/components/player/time";
import { PageCenter } from "@/components/shared/page/header";

/** The digits at the size of a running timer, or of a metric on a summary card. */
const digitsVariants = cva(
  "inline-flex w-[8ch] shrink-0 items-baseline justify-center font-mono tabular-nums",
  {
    variants: {
      size: {
        metric: "text-5xl font-light",
        timer: "text-base",
      },
    },
    defaultVariants: {
      size: "timer",
    },
  }
);

/**
 * Animates timer digits without changing the width at minute or hour rollover.
 * It holds the width of its eight monospace characters (HH:MM:SS) from the first
 * paint, before the animated digits render, so the row around it never moves
 * when they arrive.
 */
export function PlayerDigits({
  seconds,
  size,
}: VariantProps<typeof digitsVariants> & { seconds: number }) {
  const time = splitTime(seconds);

  return (
    <time className={digitsVariants({ size })} dateTime={`PT${seconds}S`}>
      <NumberFormatGroup>
        <NumberFormat
          format={{ minimumIntegerDigits: 2, useGrouping: false }}
          trend={-1}
          value={time.hours}
        />
        <span className="text-muted-foreground">:</span>
        <NumberFormat
          digits={{ 1: { max: 5 } }}
          format={{ minimumIntegerDigits: 2 }}
          trend={-1}
          value={time.minutes}
        />
        <span className="text-muted-foreground">:</span>
        <NumberFormat
          digits={{ 1: { max: 5 } }}
          format={{ minimumIntegerDigits: 2 }}
          trend={-1}
          value={time.seconds}
        />
      </NumberFormatGroup>
    </time>
  );
}

/**
 * Shows the time left in the header's centre with digits that animate as they change. From the large breakpoint a
 * player whose pane shows the time (`PlayerTimerCard`) sets `--player-clock` to hide the header's copy
 * (`PlayerProvider`), so one timer is on the screen at every width. The timer is named by the time left and stays silent while it counts; a status speaks once at five minutes
 * and once at one minute.
 */
export function PlayerTimer({ seconds }: { seconds: number }) {
  const t = useTranslations("Player");
  const notice = readTimeNotice(seconds);

  return (
    <PageCenter>
      <div className="[display:var(--player-clock,contents)]">
        <div
          aria-label={t("time-left", splitTime(seconds))}
          className="shrink-0"
          role="timer"
        >
          <PlayerDigits seconds={seconds} />
        </div>
        <output className="sr-only">
          {notice === "none" ? "" : t(`time-${notice}`)}
        </output>
      </div>
    </PageCenter>
  );
}

/**
 * The time left as the pane's card from the large breakpoint, where the header shows no timer: its name, then the
 * digits at a metric's size. It speaks as the header's timer does, and only one of the two is ever on the screen,
 * because the pane stands only from the large breakpoint and the header's copy steps aside there.
 */
export function PlayerTimerCard({ seconds }: { seconds: number }) {
  const t = useTranslations("Player");
  const notice = readTimeNotice(seconds);

  return (
    <section
      aria-label={t("time")}
      className="bg-card text-card-foreground flex flex-col items-center gap-1 rounded-xl border px-4 py-5"
      data-player-time=""
    >
      <p className="text-muted-foreground text-sm">{t("time")}</p>
      <div aria-label={t("time-left", splitTime(seconds))} role="timer">
        <PlayerDigits seconds={seconds} size="metric" />
      </div>
      <output className="sr-only">
        {notice === "none" ? "" : t(`time-${notice}`)}
      </output>
    </section>
  );
}
