import { useFrame } from "@react-three/fiber";
import {
  BELLS,
  bellGaps,
  bellPlaces,
  type RampAngle,
  RampAngleSchema,
  rampAcceleration,
  rampDistance,
} from "@repo/design-system/components/contents/physics/kinematics/galileo/ramp";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { useTimeline } from "@repo/design-system/components/contents/simulation/timeline";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import { type ReactNode, type Ref, Suspense, useRef, useState } from "react";
import { DoubleSide, type Group, type MeshStandardMaterial } from "three";

/** The ramp board: its length along the slope, width, thickness, and the ball's radius, in metres. */
const BOARD = { length: 4.4, thickness: 0.05, width: 0.16 } as const;
const BALL = 0.025;

/** How long after the ball passes a bell it keeps glowing, in seconds. */
const RING = 0.35;

/** The point at the top of the ramp where the ball starts, and the unit vector down the slope. */
function rampFrame(angle: number) {
  const tilt = (angle * Math.PI) / 180;
  const half = BOARD.length / 2;
  return {
    down: { x: Math.cos(tilt), y: -Math.sin(tilt) },
    tilt,
    top: { x: -half * Math.cos(tilt), y: 0.05 + BOARD.length * Math.sin(tilt) },
  };
}

/** The board, its groove, and the block that props up its high end. */
function Ramp({ angle }: { readonly angle: RampAngle }) {
  const frame = rampFrame(angle);
  const middle = {
    x: 0,
    y: 0.05 + (BOARD.length / 2) * Math.sin(frame.tilt) - BOARD.thickness / 2,
  };
  return (
    <group>
      <group position={[middle.x, middle.y, 0]} rotation={[0, 0, -frame.tilt]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[BOARD.length, BOARD.thickness, BOARD.width]} />
          <meshStandardMaterial color={MATERIAL.bark} roughness={0.62} />
        </mesh>
        <mesh
          position={[0, BOARD.thickness / 2 + 0.0005, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[BOARD.length, 0.022]} />
          <meshStandardMaterial color={MATERIAL.gravelGroove} roughness={0.5} />
        </mesh>
      </group>
      <mesh
        castShadow
        position={[frame.top.x + 0.12, frame.top.y / 2, 0]}
        receiveShadow
      >
        <boxGeometry args={[0.18, frame.top.y, BOARD.width + 0.04]} />
        <meshStandardMaterial color={MATERIAL.brick} roughness={0.85} />
      </mesh>
    </group>
  );
}

/** One bell on its post beside the ramp, which glows as the ball passes. */
function Bell({
  ref,
  place,
}: {
  readonly place: { readonly x: number; readonly y: number };
  readonly ref: Ref<MeshStandardMaterial>;
}) {
  return (
    <group position={[place.x, 0, -BOARD.width / 2 - 0.06]}>
      <mesh castShadow position={[0, (place.y + 0.12) / 2, 0]}>
        <cylinderGeometry args={[0.005, 0.005, place.y + 0.12, 8]} />
        <meshStandardMaterial
          color={MATERIAL.castIron}
          metalness={0.8}
          roughness={0.35}
        />
      </mesh>
      <mesh castShadow position={[0, place.y + 0.1, 0.03]}>
        <sphereGeometry
          args={[0.028, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]}
        />
        <meshStandardMaterial
          color={MATERIAL.batteryTerminal}
          emissive={PLOT_COLORS.amber}
          emissiveIntensity={0}
          metalness={1}
          ref={ref}
          roughness={0.25}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}

/** The ball rolling down from rest, the bells ringing as it reaches each one at a whole second. */
function RampScene({ angle }: { readonly angle: RampAngle }) {
  const ball = useRef<Group>(null);
  const bells = useRef<(MeshStandardMaterial | null)[]>([]);
  const { advance, playing } = useTimeline(-0.5, BELLS + 0.4);
  const frame = rampFrame(angle);
  const places = Arr.map(bellPlaces(angle), (distance) => ({
    x: frame.top.x + distance * frame.down.x,
    y: frame.top.y + distance * frame.down.y,
  }));

  useFrame((_, delta) => {
    const time = advance(delta);
    const distance = Math.min(rampDistance(angle, time), BOARD.length - 0.1);
    ball.current?.position.set(
      frame.top.x + distance * frame.down.x - Math.sin(frame.tilt) * BALL,
      frame.top.y + distance * frame.down.y + Math.cos(frame.tilt) * BALL,
      0
    );
    ball.current?.rotation.set(0, 0, -distance / BALL);
    Arr.forEach(bells.current, (bell, index) => {
      const since = time - (index + 1);
      const glow = since >= 0 && since < RING ? 4 * (1 - since / RING) : 0;
      if (bell) {
        bell.emissiveIntensity = glow;
      }
    });
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <Ramp angle={angle} />
      {Arr.map(places, (place, index) => (
        <Bell
          key={place.x}
          place={place}
          ref={(material) => {
            bells.current[index] = material;
          }}
        />
      ))}
      <group ref={ball}>
        <mesh castShadow>
          <sphereGeometry args={[BALL, 32, 16]} />
          <meshStandardMaterial
            color={MATERIAL.chrome}
            metalness={1}
            roughness={0.15}
          />
        </mesh>
      </group>
    </group>
  );
}

interface GalileoInclineBellsLabProps {
  description: ReactNode;
  labels: {
    acceleration: ReactNode;
    chooseAngle: string;
    firstSecond: ReactNode;
    gaps: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * Galileo's inclined plane: a steel ball rolls from rest down a gentle
 * wooden ramp past four bells set where it will be after 1, 2, 3 and 4 s.
 * The bells ring at an even beat although their gaps grow as 1 : 3 : 5 : 7,
 * because the distance grows with the square of the time.
 */
export function GalileoInclineBellsLab({
  description,
  labels,
  title,
}: GalileoInclineBellsLabProps) {
  const [angle, setAngle] = useState<RampAngle>(3);
  const quantity = useQuantity();
  const isAngle = Schema.is(RampAngleSchema);
  const gaps = bellGaps(angle);
  const first = gaps[0] ?? 0;

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseAngle}
          gridColumns="3"
          onValueChange={(value) => {
            const next = Number(value);
            if (isAngle(next)) {
              setAngle(next);
            }
          }}
          type="single"
          value={String(angle)}
          variant="outline"
        >
          {Arr.map(RampAngleSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={String(option)}>
              <InlineMath math={`\\theta=${option}^\\circ`} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.4} setting="lab">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[0.4, 1.7, 5.4]}
              cameraTarget={[0, 0.15, 0]}
              fov={38}
              maxDistance={8}
              minDistance={1}
            />
            <RampScene angle={angle} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.acceleration}
            value={
              <InlineMath
                math={quantity(rampAcceleration(angle), "\\text{ m/s}^2", 3)}
              />
            }
          />
          <VisualFactTabular
            label={labels.firstSecond}
            value={
              <InlineMath math={quantity(first * 100, "\\text{ cm}", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.gaps}
            value={
              <InlineMath
                math={Arr.join(
                  Arr.map(gaps, (gap) => quantity(gap / first, "", 0)),
                  " : "
                )}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
