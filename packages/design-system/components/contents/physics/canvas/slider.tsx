import { VisualSlider } from "@repo/design-system/components/visual/slider";
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
    <VisualSlider
      heading={label}
      label={name}
      max={max}
      min={min}
      onValueChange={onValueChange}
      readout={readout}
      step={step}
      value={value}
    />
  );
}
