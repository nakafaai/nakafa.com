import { useFrame } from "@react-three/fiber";
import { useRunClock } from "@repo/design-system/components/contents/biology/blood/clock";
import {
  fallen,
  fallTime,
} from "@repo/design-system/components/contents/biology/blood/run";
import {
  columnX,
  DROP,
  rowZ,
  TILE,
  TIP_HEIGHT,
} from "@repo/design-system/components/contents/biology/blood/well";
import type { ReactNode } from "react";
import { useRef } from "react";
import type { Mesh } from "three";

/** The radius of one drop, in metres: a sphere of one drop's volume. */
const DROP_RADIUS = Math.cbrt((3 * DROP) / (4 * Math.PI));

/** How long a drop takes to swell at the tip before it falls, in seconds. */
const SWELL = 0.3;

/**
 * One drop let go at `release` seconds of the run from a tip held over the
 * cavity of `column` in `row`: it swells at the tip, hanging a little long,
 * then falls the last centimetre into the cavity under gravity. Its material
 * is composed as `children`.
 */
export function FallingDrop({
  children,
  column,
  release,
  row,
}: {
  readonly children: ReactNode;
  readonly column: number;
  readonly release: number;
  readonly row: number;
}) {
  const clock = useRunClock();
  const drop = useRef<Mesh>(null);
  useFrame(() => {
    const mesh = drop.current;
    if (mesh === null) {
      return;
    }
    const since = clock.current - release;
    mesh.visible = since > -SWELL && since < fallTime(TIP_HEIGHT);
    const grown = Math.min(1, (since + SWELL) / SWELL);
    const dropped = since > 0 ? fallen(since) : 0;
    mesh.scale.set(grown, grown * 1.18, grown);
    mesh.position.set(
      columnX(column),
      TILE.height + TIP_HEIGHT - DROP_RADIUS * 1.1 * grown - dropped,
      rowZ(row)
    );
  });
  return (
    <mesh ref={drop} visible={false}>
      <sphereGeometry args={[DROP_RADIUS, 20, 14]} />
      {children}
    </mesh>
  );
}
