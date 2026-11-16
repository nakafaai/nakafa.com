import { Pavement } from "@repo/design-system/components/three/stage/pavement";
import { circlePath } from "@repo/design-system/components/three/stage/strip";
import { useMemo } from "react";

/** How many legs the ring is drawn with: enough that no bend shows. */
const RING_STEPS = 128;

/**
 * A circular track on the lab's ground, around its middle: the same asphalt,
 * lines and soft shoulders as `Road`, bent into a ring, so it has no end and
 * no cut edge.
 *
 * @param radius - The radius of the middle of the track
 * @param width - How wide the asphalt is
 * @param dash - How long a dash of the centre line is
 * @param spacing - From the start of one dash to the start of the next
 */
export function Track({
  dash,
  radius,
  spacing,
  width,
}: {
  readonly dash: number;
  readonly radius: number;
  readonly spacing: number;
  readonly width: number;
}) {
  const path = useMemo(() => circlePath(radius, RING_STEPS), [radius]);

  return (
    <Pavement closed dash={dash} path={path} spacing={spacing} width={width} />
  );
}
