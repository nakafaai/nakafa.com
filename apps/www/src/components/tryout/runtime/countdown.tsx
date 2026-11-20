import {
  NumberFormat,
  NumberFormatGroup,
} from "@repo/design-system/components/ui/number-flow";
import { Array as Arr, Option } from "effect";
import { Fragment } from "react";
import { useTranslations } from "use-intl";
import { useNow } from "@/components/player/now";
import type { DeadlinePart } from "@/components/tryout/runtime/deadline";
import { readDeadlineParts } from "@/components/tryout/runtime/deadline";

/** How a digit of the clock rolls: short and easing out, so each second lands well before the next one. */
const TICK = {
  duration: 350,
  easing: "cubic-bezier(0.23, 1, 0.32, 1)",
} as const;

/**
 * The time an attempt has left, as a clock at the text's size that ticks each second. Only the digit that
 * changes rolls, downward like the time it counts; with reduced motion it just changes. While a day or more
 * is left it reads the days, then the hours and minutes.
 */
export function TryoutClock({ expiresAt }: { expiresAt: number }) {
  const t = useTranslations("Tryouts");
  const now = useNow(true);
  const parts: readonly DeadlinePart[] = readDeadlineParts(
    Math.ceil((expiresAt - now) / 1000)
  );
  const days = Arr.findFirst(parts, (part) => part.unit === "days");
  const clock = Arr.filter(parts, (part) => part.unit !== "days");
  return (
    <NumberFormatGroup>
      <span className="inline-flex items-baseline gap-1 tabular-nums [--number-flow-mask-height:0.125em]">
        {Option.match(days, {
          onNone: () => null,
          onSome: (part) => (
            <span>
              <NumberFormat trend={-1} value={part.value} />{" "}
              {t("time-days-short")}
            </span>
          ),
        })}
        <span className="inline-flex items-baseline">
          {Arr.map(clock, (part, index) => (
            <Fragment key={part.unit}>
              {index > 0 ? <span aria-hidden="true">:</span> : null}
              <NumberFormat
                digits={index === 0 ? undefined : { 1: { max: 5 } }}
                format={{ minimumIntegerDigits: 2, useGrouping: false }}
                opacityTiming={TICK}
                spinTiming={TICK}
                transformTiming={TICK}
                trend={-1}
                value={part.value}
              />
            </Fragment>
          ))}
        </span>
      </span>
    </NumberFormatGroup>
  );
}
