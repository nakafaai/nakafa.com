import { Picture } from "@repo/design-system/components/nina/draw";
import {
  type Options,
  scene,
} from "@repo/design-system/components/nina/figure";
import { Wake } from "@repo/design-system/components/nina/wake.client";

type NinaProps = Options & {
  /**
   * What a screen reader says. Leave it empty when she only stands beside text
   * that already says it all.
   */
  label?: string;
  /** Her width in pixels. Seen whole, she is a little taller than wide; otherwise she is square. */
  size?: number;
};

/**
 * Nina, the mascot of Nakafa. A server renders her as a still picture of what
 * she does, with no script at all. When she nears the screen, or a pointer
 * comes to her, she comes alive in the same place: her limbs follow what she
 * does through springs, her eyes follow the pointer, she blinks, and a press is
 * a small surprise. With reduced motion she stays the picture.
 */
export function Nina({ label = "Nina", size = 96, ...options }: NinaProps) {
  return (
    <Wake label={label} options={options} size={size}>
      <Picture {...scene(options)} label={label} size={size} />
    </Wake>
  );
}
