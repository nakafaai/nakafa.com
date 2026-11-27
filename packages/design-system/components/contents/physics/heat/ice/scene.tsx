import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { SeamlessBenchSurface } from "@repo/design-system/components/contents/chemistry/surface";
import { BenchCamera } from "@repo/design-system/components/contents/physics/bench/camera";
import { Stand } from "@repo/design-system/components/contents/physics/bench/stand";
import { Thermometer } from "@repo/design-system/components/contents/physics/bench/thermometer";
import { useCycleClock } from "@repo/design-system/components/contents/simulation/clock";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Turn } from "@repo/design-system/components/three/form/part";
import { LiquidMaterial } from "@repo/design-system/components/three/physical";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { useRef } from "react";
import type { Group } from "three";
import { DoubleSide } from "three";

/** Seconds the mixing plays over, and how long it rests on its end. */
const PLAY_SECONDS = 8;
const HOLD_SECONDS = 2.5;
/** How many readings the mixing is cut into for the thermometer's reading and the chart. */
const STEPS = 40;

/** The cup: its inside radius at the floor and at the rim, its height, how thick its foam wall is, and how much of its front is cut away to show the inside. */
const INSIDE = { floor: 0.4, rim: 0.56 } as const;
const HEIGHT = 1.1;
const WALL = 0.09;
const OPENING = Math.PI * 0.62;
/** The ice cube's side before it melts, and the thermometer's place and height. */
const CUBE = 0.36;
const THERMOMETER = { tall: 1.5, x: 0.26, y: 0.2 } as const;

/**
 * The cup's foam, as an outline: its recessed base and the foot ring it
 * stands on, up its outside, over its rolled rim and down its inside.
 */
const CUP = [
  [0, 0.02],
  [INSIDE.floor + WALL - 0.08, 0.02],
  [INSIDE.floor + WALL - 0.05, 0],
  [INSIDE.floor + WALL, 0],
  [INSIDE.rim + WALL, HEIGHT],
  [INSIDE.rim + WALL + 0.03, HEIGHT + 0.03],
  [INSIDE.rim, HEIGHT + 0.03],
  [INSIDE.rim, HEIGHT],
  [INSIDE.floor, WALL],
  [0, WALL],
] as const;

/** How far through the mixing the water has got at `time`: fast at first, then slowing as the temperatures meet. */
export function mixingShare(time: number) {
  return 1 - (1 - time) ** 2;
}

/**
 * The mixing on the bench: an expanded-polystyrene cup with its front cut
 * away, warm water in it, an ice cube that floats and shrinks as it melts,
 * and a thermometer held in the water by a retort stand. `progress` is the
 * share of the mixing time that has passed, which the scene advances while
 * the card plays and reports through `onProgress`.
 */
export function IceMeltingScene({
  final,
  melted,
  onProgress,
  progress,
  start,
  water,
}: {
  readonly final: number;
  /** The share of the ice that melts by the end. */
  readonly melted: number;
  readonly onProgress: (progress: number) => void;
  readonly progress: number;
  readonly start: number;
  /** The share of the cup's contents that is water, by mass. */
  readonly water: number;
}) {
  const quantity = useQuantity();
  const clock = useCycleClock({
    holdSeconds: HOLD_SECONDS,
    onValue: onProgress,
    rate: 1 / PLAY_SECONDS,
    steps: STEPS,
    total: 1,
    value: progress,
  });
  const cube = useRef<Group>(null);
  const thread = useRef<Group>(null);
  const level = WALL + (HEIGHT - WALL) * (0.2 + 0.6 * water);
  const radius =
    INSIDE.floor + ((INSIDE.rim - INSIDE.floor) * (level - WALL)) / HEIGHT;
  const high = Math.max(40, start + 5);
  const share = (temperature: number) => (temperature + 5) / (high + 5);
  const shown = start + (final - start) * mixingShare(progress);

  useFrame((state) => {
    const eased = mixingShare(clock.current);
    const left = Math.cbrt(Math.max(1 - melted * eased, 0));
    if (cube.current !== null) {
      const moving = clock.current > 0 && clock.current < 1;
      const bob = moving ? Math.sin(state.clock.elapsedTime * 1.7) * 0.012 : 0;
      cube.current.visible = left > 0.06;
      cube.current.scale.setScalar(Math.max(left, 0.001));
      cube.current.position.y = level - CUBE * left * 0.38 + bob;
      cube.current.rotation.y = 0.5 + eased * 1.4;
    }
    if (thread.current !== null) {
      thread.current.scale.y = Math.max(
        0.02,
        share(start + (final - start) * eased)
      );
    }
  });

  return (
    <group>
      <BenchCamera
        narrow={[0.7, 2.3, 6.2]}
        target={[0.25, 0.9, 0]}
        wide={[0.7, 1.9, 4.5]}
      />
      <SeamlessBenchSurface />
      <mesh position={[0, WALL + (level - WALL) / 2, 0]} renderOrder={1}>
        <cylinderGeometry
          args={[radius - 0.004, INSIDE.floor - 0.004, level - WALL, 48]}
        />
        <LiquidMaterial color={APPARATUS_COLORS.waterDeep} opacity={0.42} />
      </mesh>
      <group position={[-0.1, level, 0.08]} ref={cube}>
        <RoundedBox
          args={[CUBE, CUBE, CUBE]}
          castShadow
          radius={0.045}
          renderOrder={2}
          smoothness={5}
        >
          <meshPhysicalMaterial
            clearcoat={1}
            clearcoatRoughness={0.08}
            color={APPARATUS_COLORS.iceCore}
            depthWrite={false}
            opacity={0.78}
            roughness={0.08}
            transparent
          />
        </RoundedBox>
        <mesh rotation={[0.4, 0.6, 0.2]}>
          <icosahedronGeometry args={[CUBE * 0.3, 1]} />
          <meshStandardMaterial
            color={APPARATUS_COLORS.iceCore}
            opacity={0.55}
            roughness={0.5}
            transparent
          />
        </mesh>
      </group>
      <mesh castShadow receiveShadow rotation={[0, OPENING / 2, 0]}>
        <Turn arc={[0, Math.PI * 2 - OPENING]} profile={CUP} />
        <meshStandardMaterial
          color={APPARATUS_COLORS.foamCup}
          roughness={0.96}
          side={DoubleSide}
        />
      </mesh>
      <group position={[THERMOMETER.x, THERMOMETER.y, 0.05]}>
        <Thermometer
          share={share(shown)}
          tall={THERMOMETER.tall}
          thread={thread}
        >
          <InlineMath
            math={`\\theta=${quantity(shown, "^\\circ\\text{C}", 1)}`}
          />
        </Thermometer>
      </group>
      <group position={[1.15, 0, 0.05]}>
        <Stand height={1.42} reach={0.84} tall={1.95} />
      </group>
    </group>
  );
}
