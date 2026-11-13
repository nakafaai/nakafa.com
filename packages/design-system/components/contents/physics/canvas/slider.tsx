import { Slider } from "@repo/design-system/components/ui/slider";
import type { ReactNode } from "react";

/**
 * One labelled control of a physics lab: what it sets, the value it holds
 * now as math, and the track that moves it. A lab's toolbar stacks these.
 */
export function LabSlider({
  label,
  max,
  min,
  name,
  onValueChange,
  readout,
  step,
  value,
}: {
  readonly label: ReactNode;
  readonly max: number;
  readonly min: number;
  /** The control's name for assistive technology. */
  readonly name: string;
  readonly onValueChange: (value: number) => void;
  readonly readout: ReactNode;
  readonly step: number;
  readonly value: number;
}) {
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between gap-4 text-sm">
        {label}
        <span className="shrink-0 tabular-nums">{readout}</span>
      </div>
      <Slider
        aria-label={name}
        max={max}
        min={min}
        onValueChange={(next) => onValueChange(next)}
        step={step}
        value={value}
      />
    </div>
  );
}
