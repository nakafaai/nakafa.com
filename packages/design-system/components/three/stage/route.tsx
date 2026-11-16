import { useStage } from "@repo/design-system/components/three/stage/context";
import { Pavement } from "@repo/design-system/components/three/stage/pavement";
import { throughPath } from "@repo/design-system/components/three/stage/strip";
import { GROUND_REACHES } from "@repo/design-system/components/three/stage/terrain";
import { Array as Arr } from "effect";
import { useMemo } from "react";

/** A place on the ground: across and along, in scene units. */
type Place = readonly [x: number, z: number];

/**
 * A road that bends through the places a trip passes, on the lab's ground: the
 * same asphalt, lines and soft shoulders as `Road`. A trip that returns to
 * its start is a block of streets, and any other runs on past its first and
 * last place into the haze, so no road ends in view.
 *
 * @param places - The corners of the trip, in order
 * @param width - How wide the asphalt is
 * @param dash - How long a dash of the centre line is
 * @param spacing - From the start of one dash to the start of the next
 */
export function Route({
  dash,
  places,
  spacing,
  width,
}: {
  readonly dash: number;
  readonly places: readonly Place[];
  readonly spacing: number;
  readonly width: number;
}) {
  const { reach } = useStage();
  const way = useMemo(() => {
    const end = places.length - 1;
    const first = places[0];
    const final = places[end];
    return first[0] === final[0] && first[1] === final[1]
      ? { closed: true, path: Arr.dropRight(places, 1) }
      : { closed: false, path: throughPath(places, GROUND_REACHES * reach) };
  }, [places, reach]);

  return (
    <Pavement
      closed={way.closed}
      dash={dash}
      path={way.path}
      spacing={spacing}
      width={width}
    />
  );
}
