import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { useStage } from "@repo/design-system/components/three/stage/context";
import {
  paintDashes,
  paintVerge,
} from "@repo/design-system/components/three/stage/grain";
import {
  GROUND_REACHES,
  groundTexture,
  HORIZON_FADE_INNER,
  HORIZON_FADE_OUTER,
  useGround,
  useHorizonFade,
} from "@repo/design-system/components/three/stage/terrain";
import { getColor } from "@repo/design-system/lib/color";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";

/** How far each layer of the line lies above the one under it, so none flickers through another. */
const LAYER = 0.004;

/** How tall and how wide one rail is, in gauges. */
const RAIL_HEIGHT = 0.09;
const RAIL_WIDTH = 0.08;

/**
 * A railway line along x on the lab's ground: a bed of ballast that fades
 * into the ground, timber sleepers across it, and two steel rails. It runs
 * past the lab into the haze in both directions, so it has no end to see.
 *
 * @param gauge - How far apart the two rails are
 * @param sleeper - How wide one sleeper is along the line
 * @param spacing - From the start of one sleeper to the start of the next
 */
export function Rail({
  gauge,
  sleeper,
  spacing,
}: {
  readonly gauge: number;
  readonly sleeper: number;
  readonly spacing: number;
}) {
  const { floor = 0, reach } = useStage();
  const length = 2 * GROUND_REACHES * reach;
  const bed = gauge * 3;
  const ballast = useGround("concrete", [length / gauge, 3]);
  const marks = useMemo(
    () => ({
      sleepers: groundTexture(paintDashes(64, sleeper / spacing), 64, 1, [
        length / spacing,
        1,
      ]),
      verge: groundTexture(paintVerge(64, 0.3), 1, 64, [1, 1]),
    }),
    [length, sleeper, spacing]
  );

  useEffect(
    () => () => {
      marks.sleepers.dispose();
      marks.verge.dispose();
    },
    [marks]
  );

  const horizonFade = useHorizonFade(
    HORIZON_FADE_INNER * reach,
    HORIZON_FADE_OUTER * reach
  );

  return (
    <CameraBounds exclude>
      <group position={[0, floor, 0]}>
        <group rotation={[-Math.PI / 2, 0, 0]}>
          <mesh position={[0, 0, LAYER]} receiveShadow renderOrder={-8}>
            <planeGeometry args={[length, bed]} />
            <meshStandardMaterial
              alphaMap={marks.verge}
              bumpMap={ballast.bump}
              bumpScale={0.9}
              depthWrite={false}
              map={ballast.map}
              ref={horizonFade}
              roughness={0.97}
              transparent
            />
          </mesh>
          <mesh position={[0, 0, LAYER * 2]} receiveShadow renderOrder={-7}>
            <planeGeometry args={[length, gauge * 1.9]} />
            <meshStandardMaterial
              alphaMap={marks.sleepers}
              alphaTest={0.5}
              color={getColor("STONE", 600)}
              depthWrite={false}
              ref={horizonFade}
              roughness={0.9}
              transparent
            />
          </mesh>
        </group>
        {Arr.map([-1, 1] as const, (side) => (
          <mesh
            castShadow
            key={side}
            position={[0, (gauge * RAIL_HEIGHT) / 2, (side * gauge) / 2]}
            receiveShadow
            renderOrder={-6}
          >
            <boxGeometry
              args={[length, gauge * RAIL_HEIGHT, gauge * RAIL_WIDTH]}
            />
            <meshStandardMaterial
              color={getColor("SLATE", 400)}
              depthWrite
              metalness={0.6}
              ref={horizonFade}
              roughness={0.32}
              transparent
            />
          </mesh>
        ))}
      </group>
    </CameraBounds>
  );
}
