import type { Tone } from "@repo/design-system/components/three/sky/air";

/**
 * How bright every lab is exposed before the film curve. It is one number
 * for all of them, so a lab is never brightened or dimmed by itself.
 */
export const EXPOSURE = 1;

/** The ACES curve's own brightening, which three applies with it. */
const ACES_GAIN = 1 / 0.6;

/** The fitted ACES curve from scene light to display light, for one channel. */
function curve(value: number) {
  return (
    (value * (value + 0.024_578_6) - 0.000_090_537) /
    (value * (0.983_729 * value + 0.432_951) + 0.238_081)
  );
}

/**
 * Passes a linear tone through the film curve every lab is drawn with (ACES
 * filmic, as three fits it), giving the linear tone the display shows. The
 * graphics card does this for everything it draws; the haze is a plain
 * colour mixed in after that curve, so it takes the same curve here and
 * meets the sky it stands for.
 *
 * @param tone - The scene's linear tone
 */
export function filmed([red, green, blue]: Tone): Tone {
  const gain = EXPOSURE * ACES_GAIN;
  const r = curve(gain * (0.597_19 * red + 0.354_58 * green + 0.048_23 * blue));
  const g = curve(gain * (0.076 * red + 0.908_34 * green + 0.015_66 * blue));
  const b = curve(gain * (0.0284 * red + 0.133_83 * green + 0.837_77 * blue));
  const shown = (value: number) => Math.min(1, Math.max(0, value));
  return [
    shown(1.604_75 * r - 0.531_08 * g - 0.073_67 * b),
    shown(-0.102_08 * r + 1.108_13 * g - 0.006_05 * b),
    shown(-0.003_27 * r - 0.072_76 * g + 1.076_02 * b),
  ];
}
