import { useStage } from "@repo/design-system/components/three/stage/context";
import { Pavement } from "@repo/design-system/components/three/stage/pavement";
import { GROUND_REACHES } from "@repo/design-system/components/three/stage/terrain";
import { useMemo } from "react";

/**
 * A road along x on the lab's ground: a gravel shoulder that fades into the
 * ground, the asphalt, its two edge lines and its dashed centre line. It runs
 * past the lab into the haze in both directions, so it has no end to see.
 *
 * @param width - How wide the asphalt is
 * @param dash - How long a dash of the centre line is
 * @param spacing - From the start of one dash to the start of the next
 */
export function Road({
  dash,
  spacing,
  width,
}: {
  readonly dash: number;
  readonly spacing: number;
  readonly width: number;
}) {
  const { reach } = useStage();
  const path = useMemo(
    () =>
      [
        [-GROUND_REACHES * reach, 0],
        [GROUND_REACHES * reach, 0],
      ] as const,
    [reach]
  );

  return (
    <Pavement
      closed={false}
      dash={dash}
      path={path}
      spacing={spacing}
      width={width}
    />
  );
}
