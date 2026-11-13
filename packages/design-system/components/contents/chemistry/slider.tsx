import { Slider } from "@repo/design-system/components/ui/slider";
import { useVisual } from "@repo/design-system/components/visual/card";

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
  const { playing, togglePlaying } = useVisual((state) => ({
    playing: state.playing,
    togglePlaying: state.togglePlaying,
  }));

  return (
    <Slider
      aria-label={label}
      max={max}
      min={0}
      onValueChange={(next: number) => {
        if (playing) {
          togglePlaying();
        }
        onChange(next);
      }}
      step={step}
      value={value}
    />
  );
}
