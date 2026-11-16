import { Picture } from "@repo/design-system/components/ui/picture";
import { EMBER_BOX, ember, flame, flameBox } from "@repo/mascot/flame/draw";

/** A flame marks nothing in its picture. */
function unmarked() {
  return {};
}

/**
 * The flame of a run of days at its stage, in a window that holds it and
 * nothing more, sized by its class: out at stage 0, and greater at every stage
 * after it. It only
 * decorates the count beside it, so a screen reader skips it.
 */
export function Flame({
  className,
  stage,
}: {
  className?: string;
  /** How far the run has come, from 1; 0 when the fire is out. */
  stage: number;
}) {
  return (
    <Picture
      box={flameBox(stage)}
      className={className}
      marked={unmarked}
      shapes={flame(stage)}
    />
  );
}

/**
 * One day of a week of learning, drawn to fill the width its class gives it: a
 * small flame once the learner learned on it, cold coals until then.
 */
export function Ember({
  className,
  lit,
}: {
  className?: string;
  lit: boolean;
}) {
  return (
    <Picture
      box={EMBER_BOX}
      className={className}
      marked={unmarked}
      shapes={ember(lit)}
    />
  );
}
