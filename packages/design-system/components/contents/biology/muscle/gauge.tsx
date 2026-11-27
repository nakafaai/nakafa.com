import { MUSCLE_COLORS } from "@repo/design-system/lib/material/muscle";
import type { ReactNode } from "react";

/**
 * The lactic acid gauge of a readout: a bar that fills amber from 0 to the
 * lab's most lactic acid, beside the reading itself.
 */
export function LacticGauge({
  children,
  level,
}: {
  readonly children: ReactNode;
  readonly level: number;
}) {
  return (
    <span className="flex items-center gap-3">
      <span className="bg-muted h-2 w-20 shrink-0 overflow-hidden rounded-full">
        <span
          className="block h-full rounded-full"
          style={{
            backgroundColor: MUSCLE_COLORS.lactate,
            width: `${Math.round(level * 100)}%`,
          }}
        />
      </span>
      {children}
    </span>
  );
}
