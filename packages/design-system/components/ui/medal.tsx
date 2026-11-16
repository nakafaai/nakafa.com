import { Picture } from "@repo/design-system/components/ui/picture";
import { MEDAL_BOX, medal } from "@repo/mascot/medal/draw";
import type { MedalSchema } from "@repo/mascot/medal/name";

/** A medal marks nothing in its picture. */
function unmarked() {
  return {};
}

/**
 * One medal of the product at the tier a learner reached, drawn to fill the
 * width its class gives it: in the identity's colours from tier 1, its stars,
 * metal and rim saying the tier, and as a quiet silhouette in the colour of
 * the text round it at tier 0, while it is still to earn. It only decorates
 * the name beside it, so a screen reader skips it.
 */
export function Medal({
  className,
  name,
  tier,
}: {
  className?: string;
  name: typeof MedalSchema.Type;
  /** The tier reached, from 1; 0 while the medal is still to earn. */
  tier: number;
}) {
  return (
    <Picture
      box={MEDAL_BOX}
      className={className}
      marked={unmarked}
      shapes={medal(name, tier)}
    />
  );
}
