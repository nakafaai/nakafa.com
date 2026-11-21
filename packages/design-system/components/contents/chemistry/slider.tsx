import { VisualSlider } from "@repo/design-system/components/visual/slider";

/**
 * A slider that runs the scene by hand: taking it stops the card playing, so
 * the reader's hand, not the clock, moves the scene.
 */
export function HandSlider({
  label,
  max,
  onChange,
  step,
  value,
}: {
  readonly label: string;
  readonly max: number;
  readonly onChange: (value: number) => void;
  readonly step: number;
  readonly value: number;
}) {
  return (
    <VisualSlider
      label={label}
      max={max}
      min={0}
      onValueChange={onChange}
      pauseOnChange
      step={step}
      value={value}
    />
  );
}
