import {
  NumberFormat,
  NumberFormatGroup,
} from "@repo/design-system/components/ui/number-flow";
import { cn } from "cn";
import { useTranslations } from "use-intl";
import { readTimeNotice, splitTime } from "@/components/player/time";

/**
 * Animates timer digits without changing the width at minute or hour rollover.
 * It holds the width of its eight monospace characters (HH:MM:SS) from the first
 * paint, before the animated digits render, so the row around it never moves
 * when they arrive.
 */
export function PlayerDigits({
  className,
  seconds,
}: {
  className?: string;
  seconds: number;
}) {
  const time = splitTime(seconds);

  return (
    <time
      className={cn(
        "inline-flex w-[8ch] shrink-0 items-baseline justify-center font-mono text-base tabular-nums",
        className
      )}
      dateTime={`PT${seconds}S`}
    >
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
 * Shows the time left with digits that animate as they change. The timer is
 * named by the time left and stays silent while it counts; a status speaks
 * once at five minutes and once at one minute.
 */
export function PlayerTimer({ seconds }: { seconds: number }) {
  const t = useTranslations("Player");
  const notice = readTimeNotice(seconds);

  return (
    <>
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
    </>
  );
}
