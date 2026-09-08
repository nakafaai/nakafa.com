import {
  NumberFormat,
  NumberFormatGroup,
} from "@repo/design-system/components/ui/number-flow";
import { TryoutTimer } from "@/components/tryout/runtime/countdown";

/** Renders the production try-out metric number style. */
export function TryoutMetricNumber({ value }: { value: number }) {
  return (
    <div className="font-light font-mono text-5xl text-foreground tabular-nums leading-none">
      <NumberFormat value={value} />
    </div>
  );
}

/** Renders one correct-answer fraction with stable metric dimensions. */
export function TryoutMetricFraction({
  correct,
  total,
}: {
  correct: number;
  total: number;
}) {
  return (
    <NumberFormatGroup>
      <div className="flex items-center gap-1">
        <TryoutMetricNumber value={correct} />
        <span className="font-light font-mono text-3xl text-muted-foreground leading-none">
          /
        </span>
        <TryoutMetricNumber value={total} />
      </div>
    </NumberFormatGroup>
  );
}

/** Uses the same timer format for the section's pre-start duration. */
export function TryoutMetricTime({ totalSeconds }: { totalSeconds: number }) {
  return <TryoutTimer className="font-light text-5xl" seconds={totalSeconds} />;
}
