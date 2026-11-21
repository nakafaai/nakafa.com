import { Slider } from "@repo/design-system/components/ui/slider";
import { usePauseVisualScene } from "@repo/design-system/components/visual/card";
import type { ReactNode } from "react";

/**
 * Shared slider control for interactive visuals and 3D labs. Optional heading
 * and readout render above the track inside the same control group, and
 * `pauseOnChange` stops the card's clock when the learner scrubs time or
 * progress by hand so playback never fights the thumb.
 */
export function VisualSlider({
  disabled,
  heading,
  label,
  max,
  min = 0,
  onValueChange,
  pauseOnChange = false,
  readout,
  step = 1,
  value,
}: {
  readonly disabled?: boolean | undefined;
  readonly heading?: ReactNode;
  readonly label: string;
  readonly max: number;
  readonly min?: number;
  readonly onValueChange: (value: number) => void;
  readonly pauseOnChange?: boolean;
  readonly readout?: ReactNode;
  readonly step?: number;
  readonly value: number;
}) {
  const pause = usePauseVisualScene();

  const handleChange = (next: number) => {
    if (pauseOnChange) {
      pause();
    }
    onValueChange(next);
  };

  const optionalDisabled = disabled === undefined ? {} : { disabled };

  if (heading === undefined && readout === undefined) {
    return (
      <Slider
        aria-label={label}
        {...optionalDisabled}
        max={max}
        min={min}
        onValueChange={handleChange}
        step={step}
        value={value}
      />
    );
  }

  return (
    <div className="flex min-w-48 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-4 text-sm">
        {heading === undefined ? null : <span>{heading}</span>}
        {readout === undefined ? null : (
          <span className="shrink-0 tabular-nums">{readout}</span>
        )}
      </div>
      <Slider
        aria-label={label}
        {...optionalDisabled}
        max={max}
        min={min}
        onValueChange={handleChange}
        step={step}
        value={value}
      />
    </div>
  );
}
