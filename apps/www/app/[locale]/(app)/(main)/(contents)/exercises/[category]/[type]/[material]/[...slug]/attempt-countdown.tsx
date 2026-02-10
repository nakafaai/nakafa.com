"use client";

import {
  NumberFormat,
  NumberFormatGroup,
} from "@repo/design-system/components/ui/number-flow";

interface CountdownProps {
  timer: {
    formatted: {
      hours: number;
      minutes: number;
      seconds: number;
    };
  };
}

export function Countdown({ timer }: CountdownProps) {
  const { formatted } = timer;

  return (
    <div className="pl-2">
      <NumberFormatGroup>
        <div className="flex items-baseline font-mono text-lg tabular-nums">
          <NumberFormat
            format={{ minimumIntegerDigits: 2 }}
            trend={-1}
            value={formatted.hours}
          />
          <NumberFormat
            digits={{ 1: { max: 5 } }}
            format={{ minimumIntegerDigits: 2 }}
            prefix=":"
            trend={-1}
            value={formatted.minutes}
          />
          <NumberFormat
            digits={{ 1: { max: 5 } }}
            format={{ minimumIntegerDigits: 2 }}
            prefix=":"
            trend={-1}
            value={formatted.seconds}
          />
        </div>
      </NumberFormatGroup>
    </div>
  );
}
