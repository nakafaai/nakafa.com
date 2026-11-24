import { useFrame } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  AutoclaveModel,
  ChemicalBottle,
  GlassBoxModel,
  SharpsBin,
  SinkModel,
  TrayModel,
} from "@repo/design-system/components/contents/biology/waste/fixtures";
import { WastePiece } from "@repo/design-system/components/contents/biology/waste/pieces";
import {
  pathOf,
  poseAt,
} from "@repo/design-system/components/contents/biology/waste/pose";
import {
  levelOf,
  lipOf,
} from "@repo/design-system/components/contents/biology/waste/pour";
import type {
  Route,
  Waste,
} from "@repo/design-system/components/contents/biology/waste/route";
import {
  durationOf,
  nextOf,
  pourOf,
  slotOf,
} from "@repo/design-system/components/contents/biology/waste/route";
import { BENCH } from "@repo/design-system/components/contents/biology/waste/station";
import {
  celsiusAt,
  gaugePressure,
  isVenting,
  needleAngle,
} from "@repo/design-system/components/contents/biology/waste/steam";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Option } from "effect";
import { useEffect, useMemo, useRef } from "react";
import { BufferGeometry, Vector3 } from "three";

const HOLD_AFTER = 1.4;
const CAMERA_POSITION: readonly [number, number, number] = [0.05, 0.72, 1.18];
const CAMERA_TARGET: readonly [number, number, number] = [0.02, 0.14, -0.02];

/**
 * Benchtop waste station rendered at real metres from `station.ts`: the tray
 * of items on the front left, the sink, amber chemical waste bottle with
 * funnel, yellow sharps container, broken glass box, and benchtop autoclave
 * with animated lid, inner container, steam vent and pressure gauge.
 */
export function WasteScene({
  active,
  items,
  names,
  onPick,
  onSeconds,
  route,
  seconds,
}: {
  readonly active: Waste;
  readonly items: readonly [Waste, ...Waste[]];
  readonly names: Readonly<Partial<Record<Waste, string>>>;
  readonly onPick: (item: Waste) => void;
  readonly onSeconds: (seconds: number) => void;
  readonly route: Route;
  readonly seconds: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const clock = useRef(seconds);
  const lastReported = useRef(seconds);
  const total = durationOf(route);

  if (!playing) {
    clock.current = seconds;
    lastReported.current = seconds;
  }

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    clock.current += simulationStep(delta);
    if (clock.current >= total + HOLD_AFTER) {
      clock.current = 0;
      lastReported.current = 0;
      onPick(nextOf(items, active));
      onSeconds(0);
      return;
    }
    if (Math.abs(clock.current - lastReported.current) >= 0.04) {
      lastReported.current = clock.current;
      onSeconds(Math.min(total, clock.current));
    }
  });

  const pose = poseAt(route, seconds);
  const celsius = celsiusAt(pose.heat);
  const angle = needleAngle(gaugePressure(celsius));
  const venting = isVenting(pose.heat);
  const pour = pourOf(route.place);
  const routePoints = useMemo(() => pathOf(route, 44), [route]);
  const lineGeometry = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setFromPoints(
      Arr.map(routePoints, ([x, y, z]) => new Vector3(x, y, z))
    );
    return geometry;
  }, [routePoints]);

  useEffect(() => () => lineGeometry.dispose(), [lineGeometry]);

  return (
    <group>
      <CameraControls
        cameraPosition={CAMERA_POSITION}
        cameraTarget={CAMERA_TARGET}
        fov={40}
      />

      <mesh position={[0, -BENCH.top / 2, 0]} receiveShadow>
        <boxGeometry args={[BENCH.width, BENCH.top, BENCH.depth]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.worktop}
          roughness={0.6}
        />
      </mesh>

      <SinkModel running={pose.tap} />
      <ChemicalBottle />
      <SharpsBin />
      <GlassBoxModel />
      <AutoclaveModel
        angle={angle}
        container={pose.container}
        lid={pose.lid}
        venting={venting}
      />
      <TrayModel />

      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial
          color={PLOT_COLORS.teal}
          opacity={0.45}
          transparent
        />
      </lineSegments>

      {Arr.map(items, (item, index) => {
        if (item === active) {
          return null;
        }
        const position = slotOf(index, items.length);
        return (
          <group
            key={item}
            onPointerDown={(event) => {
              event.stopPropagation();
              onPick(item);
            }}
            position={position}
          >
            <WastePiece item={item} />
          </group>
        );
      })}

      <group position={pose.item} rotation={[pose.rotation, 0, 0]}>
        <WastePiece
          item={active}
          liquidLevel={Option.match(pour, {
            onNone: () => undefined,
            onSome: ({ vessel }) =>
              Math.max(
                0.002,
                levelOf(vessel, pose.item, pose.rotation) - pose.item[1]
              ),
          })}
        />
      </group>

      {pose.pouring &&
        Option.match(pour, {
          onNone: () => null,
          onSome: ({ end, vessel }) => {
            const lip = lipOf(vessel, pose.item, pose.rotation);
            const height = Math.max(0.01, lip[1] - end);
            return (
              <mesh position={[lip[0], end + height / 2, lip[2]]}>
                <cylinderGeometry args={[0.004, 0.005, height, 12]} />
                <meshStandardMaterial
                  color={
                    route.place === "sink"
                      ? LABORATORY_COLORS.water
                      : PLOT_COLORS.amber
                  }
                  opacity={0.8}
                  transparent
                />
              </mesh>
            );
          },
        })}

      {names[active] !== undefined && (
        <ThreeLabel
          anchorY="bottom"
          color={ink}
          gap={0.07}
          position={[pose.item[0], pose.item[1] + 0.06, pose.item[2]]}
        >
          {names[active]}
        </ThreeLabel>
      )}
    </group>
  );
}
