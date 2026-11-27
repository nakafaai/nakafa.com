import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { useStage } from "@repo/design-system/components/three/stage/context";
import {
  paintDashes,
  paintVerge,
} from "@repo/design-system/components/three/stage/marks";
import {
  Band,
  useBand,
  useWay,
} from "@repo/design-system/components/three/stage/pavement";
import { drape } from "@repo/design-system/components/three/stage/relief";
import {
  GROUND_REACHES,
  GroundMaterial,
  groundTexture,
  HORIZON_FADE_INNER,
  HORIZON_FADE_OUTER,
  useHorizonFade,
  useRelief,
} from "@repo/design-system/components/three/stage/terrain";
import { getColor } from "@repo/design-system/lib/color";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { BoxGeometry } from "three";

/** How tall and how wide one rail is, in gauges. */
const RAIL_HEIGHT = 0.09;
const RAIL_WIDTH = 0.08;

/**
 * A railway line along x on the lab's ground: a bed of ballast that fades
 * into the ground, timber sleepers across it, and two steel rails, all laid
 * on the ground's relief. It runs past the lab into the haze in both
 * directions, so it has no end to see.
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
  const { floor = 0, profile, reach } = useStage();
  const length = 2 * GROUND_REACHES * reach;
  const marks = useMemo(
    () => ({
      sleepers: groundTexture(paintDashes(64, sleeper / spacing), 64, 1, [
        1 / spacing,
        1,
      ]),
      verge: groundTexture(paintVerge(64, 0.3), 1, 64, [1, 1]),
    }),
    [sleeper, spacing]
  );

  useEffect(
    () => () => {
      marks.sleepers.dispose();
      marks.verge.dispose();
    },
    [marks]
  );

  const line = useMemo(
    () =>
      [
        [-length / 2, 0],
        [length / 2, 0],
      ] as const,
    [length]
  );
  const way = useWay(line, false);
  const bed = useBand(way, false, -gauge * 1.5, gauge * 1.5);
  const ties = useBand(way, false, -gauge * 0.95, gauge * 0.95);
  const heightAt = useRelief();
  const rails = useMemo(
    () =>
      Arr.map([-1, 1] as const, (side) => {
        const rail = new BoxGeometry(
          length,
          gauge * RAIL_HEIGHT,
          gauge * RAIL_WIDTH,
          2 * profile.landSpokes
        );
        rail.translate(0, (gauge * RAIL_HEIGHT) / 2, (side * gauge) / 2);
        drape(rail.getAttribute("position").array, heightAt);
        rail.computeVertexNormals();
        return rail;
      }),
    [gauge, heightAt, length, profile]
  );

  useEffect(
    () => () => {
      for (const rail of rails) {
        rail.dispose();
      }
    },
    [rails]
  );

  const horizonFade = useHorizonFade(
    HORIZON_FADE_INNER * reach,
    HORIZON_FADE_OUTER * reach
  );

  return (
    <CameraBounds exclude>
      <Band geometry={bed} layer={1}>
        <GroundMaterial
          alphaMap={marks.verge}
          depthWrite={false}
          kind="concrete"
          layer={1}
          repeat={[1 / gauge, 3]}
        />
      </Band>
      <Band geometry={ties} layer={2}>
        <meshStandardMaterial
          alphaMap={marks.sleepers}
          alphaTest={0.5}
          color={getColor("STONE", 600)}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-8}
          ref={horizonFade}
          roughness={0.9}
          transparent
        />
      </Band>
      {Arr.map(rails, (rail, index) => (
        <mesh
          castShadow
          geometry={rail}
          key={index === 0 ? "near" : "far"}
          position={[0, floor, 0]}
          receiveShadow
          renderOrder={-6}
        >
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
    </CameraBounds>
  );
}
