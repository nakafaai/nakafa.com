import { useFrame } from "@react-three/fiber";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";

type Point = readonly [number, number, number];

/** How far apart the charge markers ride along a lead that carries a current. */
const MARKER_SPACING = 0.46;

/**
 * A flexible insulated lead laid through `points`, as a tube along a smooth
 * curve. When it carries a `flow`, glowing markers of charge show on it and
 * drift in the direction of conventional current while the card plays, at `flow` scene
 * units a second: faster for a larger current and backwards for a negative
 * one, so a reader sees which branch carries more.
 */
export function Lead({
  color,
  flow = 0,
  points,
  radius = 0.02,
}: {
  readonly color: string;
  readonly flow?: number;
  readonly points: readonly Point[];
  readonly radius?: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const markers = useRef<Group>(null);
  const phase = useRef(0);
  const curve = useMemo(
    () =>
      new CatmullRomCurve3(
        Arr.map(points, ([x, y, z]) => new Vector3(x, y, z)),
        false,
        "catmullrom",
        0.18
      ),
    [points]
  );
  const tube = useMemo(
    () => new TubeGeometry(curve, points.length * 14, radius, 12, false),
    [curve, points.length, radius]
  );
  useEffect(() => () => tube.dispose(), [tube]);
  const length = useMemo(() => curve.getLength(), [curve]);
  const count = Math.max(2, Math.round(length / MARKER_SPACING));

  useFrame((_, delta) => {
    const group = markers.current;
    if (group === null || !playing || flow === 0) {
      return;
    }
    phase.current =
      (phase.current + (simulationStep(delta) * flow) / length + 1) % 1;
    Arr.forEach(group.children, (marker, index) => {
      marker.position.copy(
        curve.getPointAt((phase.current + index / count) % 1)
      );
    });
  });

  return (
    <group>
      <mesh castShadow geometry={tube} receiveShadow>
        <Matter color={color} of="plastic" />
      </mesh>
      {flow !== 0 && playing ? (
        <group ref={markers}>
          {Arr.makeBy(count, (index) => (
            <mesh key={index} position={curve.getPointAt(index / count)}>
              <sphereGeometry args={[radius * 1.12, 12, 10]} />
              <Matter color={APPARATUS_COLORS.lampHalo} of="light" />
            </mesh>
          ))}
        </group>
      ) : null}
    </group>
  );
}

/**
 * A 4 mm binding post screwed into the board: a brass stud with a knurled
 * insulating cap in the colour of the lead it takes.
 */
export function Post({
  color,
  position,
}: {
  readonly color: string;
  readonly position: Point;
}) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.012, 0]}>
        <cylinderGeometry args={[0.042, 0.046, 0.024, 6]} />
        <Matter of="brass" />
      </mesh>
      <mesh castShadow position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.016, 0.016, 0.1, 14]} />
        <Matter of="brass" />
      </mesh>
      <mesh castShadow position={[0, 0.082, 0]}>
        <cylinderGeometry args={[0.038, 0.034, 0.05, 18]} />
        <Matter color={color} of="plastic" />
      </mesh>
    </group>
  );
}
