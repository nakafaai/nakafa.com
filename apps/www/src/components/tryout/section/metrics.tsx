import {
  NumberFormat,
  NumberFormatGroup,
} from "@repo/design-system/components/ui/number-flow";
import type { ReactNode } from "react";

/** Renders the production try-out metric number style. */
export function TryoutMetricNumber({ value }: { value: number }) {
  return (
    <div className="font-light font-mono text-5xl text-foreground tabular-nums leading-none">
      <NumberFormat value={value} />
    </div>
  );
}

/** Groups the two numbers of a correct-answer fraction, so they keep stable metric dimensions. */
export function TryoutMetricFraction({ children }: { children: ReactNode }) {
  return (
    <NumberFormatGroup>
      <div className="flex items-center gap-1">{children}</div>
    </NumberFormatGroup>
  );
}

/** The slash between the two numbers of a correct-answer fraction. */
export function TryoutMetricSlash() {
  return (
    <span className="font-light font-mono text-3xl text-muted-foreground leading-none">
      /
    </span>
  );
}
