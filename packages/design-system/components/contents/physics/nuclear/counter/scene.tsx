import { useFrame } from "@react-three/fiber";
import { BenchCamera } from "@repo/design-system/components/contents/physics/bench/camera";
import { Lead } from "@repo/design-system/components/contents/physics/bench/lead";
import {
  METER_POSTS,
  Meter,
} from "@repo/design-system/components/contents/physics/bench/meter";
import { recordedRate } from "@repo/design-system/components/contents/physics/nuclear/decay";
import { useCycleClock } from "@repo/design-system/components/contents/simulation/clock";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group, MeshPhysicalMaterial } from "three";
import { Vector3 } from "three";

/** Seconds the whole record plays over, and how long it rests on its end. */
const PLAY_SECONDS = 8;
const HOLD_SECONDS = 2;
/** How many readings the record is cut into for the meter's reading and the chart. */
const STEPS = 48;

/** The height the source and the tube's axis share, where the source's foil sits, and where the tube's window is. */
const AXIS = 0.62;
const SOURCE = -1.25;
const WINDOW = -0.35;
/** The tube: how long it is and its radius. */
const TUBE = { length: 1.15, radius: 0.15 } as const;
/** The particles drawn at the starting rate, how far one flies before it is lost, and how many of the background's cross the bench. */
const PARTICLES = 34;
const RANGE = 1.7;
const STRAYS = 5;

const METER_AT = [1.55, 0, 0.5] as const;
const CABLE = [
  [WINDOW + TUBE.length + 0.08, AXIS, 0],
  [WINDOW + TUBE.length + 0.4, AXIS - 0.1, 0.1],
  [1.5, 0.12, 0.5],
  [METER_AT[0] + METER_POSTS[0][0], 0.12, METER_AT[2] + 0.42],
  [
    METER_AT[0] + METER_POSTS[0][0],
    METER_POSTS[0][1] + 0.1,
    METER_AT[2] + METER_POSTS[0][2],
  ],
] as const;
const AHEAD = new Vector3(1, 0, 0);

/**
 * The half-life measurement on the bench: a sealed source in a brass holder
 * facing the mica window of a Geiger-Muller tube, whose cable runs to a
 * ratemeter. While the card plays, particles leave the source, fewer and
 * fewer as it decays, while the few stray ones of the background keep
 * crossing the bench; the tube's lamp flashes at each count and the meter
 * falls toward the background. `progress` is the share of the record that
 * has passed, which the scene advances and reports through `onProgress`.
 */
export function HalfLifeCounterScene({
  background,
  halfLife,
  onProgress,
  progress,
  start,
  time,
}: {
  readonly background: number;
  readonly halfLife: number;
  readonly onProgress: (progress: number) => void;
  readonly progress: number;
  /** The sample's own starting rate, without the background. */
  readonly start: number;
  readonly time: number;
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
  const elapsed = useRef(0);
  const swarm = useRef<Group>(null);
  const strays = useRef<Group>(null);
  const lamp = useRef<MeshPhysicalMaterial>(null);
  const flights = useMemo(
    () =>
      Arr.makeBy(PARTICLES, (index) => {
        const lean = (hashUnit(index, 31) - 0.5) * 1.5;
        const turn = hashUnit(index, 32) * Math.PI * 2;
        return {
          key: index,
          pace: 0.7 + hashUnit(index, 33) * 0.5,
          phase: hashUnit(index, 34),
          way: new Vector3(
            Math.cos(lean),
            Math.sin(lean) * Math.cos(turn),
            Math.sin(lean) * Math.sin(turn)
          ),
        };
      }),
    []
  );
  const crossings = useMemo(
    () =>
      Arr.makeBy(STRAYS, (index) => ({
        from: new Vector3(
          (hashUnit(index, 41) - 0.5) * 3,
          2.4,
          -1.2 - hashUnit(index, 42)
        ),
        key: index,
        pace: 0.35 + hashUnit(index, 43) * 0.3,
        phase: hashUnit(index, 44),
        to: new Vector3(
          WINDOW + hashUnit(index, 45) * TUBE.length,
          0.1,
          0.8 * hashUnit(index, 46)
        ),
      })),
    []
  );
  const sample = { halfLife, start };
  const rate = recordedRate(sample, background, progress * time);
  const full = start + background;

  useFrame((_, delta) => {
    const running = clock.current > 0 && clock.current < 1;
    if (running) {
      elapsed.current += simulationStep(delta);
    }
    const alive = 2 ** ((-clock.current * time) / halfLife);
    Arr.forEach(swarm.current?.children ?? [], (mesh, index) => {
      const flight = flights[index];
      if (flight === undefined) {
        return;
      }
      const far = ((elapsed.current * flight.pace + flight.phase) % 1) * RANGE;
      mesh.position
        .set(SOURCE + 0.06, AXIS, 0)
        .addScaledVector(flight.way, far);
      mesh.quaternion.setFromUnitVectors(AHEAD, flight.way);
      const inside =
        mesh.position.x > WINDOW &&
        Math.hypot(mesh.position.y - AXIS, mesh.position.z) < TUBE.radius;
      mesh.visible = (index + 0.5) / PARTICLES < alive && !inside;
    });
    Arr.forEach(strays.current?.children ?? [], (mesh, index) => {
      const crossing = crossings[index];
      if (crossing === undefined) {
        return;
      }
      const along = (elapsed.current * crossing.pace + crossing.phase) % 1;
      mesh.position.lerpVectors(crossing.from, crossing.to, along);
      mesh.visible = running;
    });
    if (lamp.current !== null) {
      // The lamp flashes more often the higher the recorded rate is.
      const beat = elapsed.current * (3 + 16 * alive);
      const lit =
        running && hashUnit(Math.floor(beat), 51) < 0.25 + alive * 0.5;
      lamp.current.emissiveIntensity = lit ? 2.4 : 0.05;
    }
  });

  return (
    <group>
      <BenchCamera
        narrow={[0.4, 2.2, 7.4]}
        target={[0.25, 0.55, 0.1]}
        wide={[0.5, 1.7, 4.9]}
      />
      <group position={[SOURCE, 0, 0]}>
        <mesh castShadow position={[-0.08, 0.02, 0]} receiveShadow>
          <cylinderGeometry args={[0.24, 0.26, 0.04, 40]} />
          <Matter of="steel" />
        </mesh>
        <mesh castShadow position={[-0.08, AXIS / 2, 0]}>
          <cylinderGeometry args={[0.025, 0.025, AXIS, 16]} />
          <Matter of="nickel" />
        </mesh>
        <mesh
          castShadow
          position={[-0.06, AXIS, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.13, 0.13, 0.16, 40]} />
          <Matter of="brass" />
        </mesh>
        <mesh position={[0.022, AXIS, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.1, 0.006, 32]} />
          <Matter color={APPARATUS_COLORS.sourceHolder} of="enamel" />
        </mesh>
        <mesh position={[0.027, AXIS, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.045, 0.045, 0.006, 24]} />
          <Matter of="nickel" />
        </mesh>
      </group>
      <group position={[WINDOW, 0, 0]}>
        <mesh
          castShadow
          position={[TUBE.length / 2, AXIS, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry
            args={[TUBE.radius, TUBE.radius, TUBE.length, 48]}
          />
          <Matter of="brass" />
        </mesh>
        <mesh position={[-0.004, AXIS, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry
            args={[TUBE.radius - 0.02, TUBE.radius - 0.02, 0.008, 40]}
          />
          <Matter of="mica" />
        </mesh>
        <mesh position={[0, AXIS, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[TUBE.radius, 0.016, 12, 48]} />
          <Matter of="nickel" />
        </mesh>
        <mesh
          castShadow
          position={[TUBE.length + 0.05, AXIS, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.07, TUBE.radius, 0.1, 32]} />
          <Matter of="bakelite" />
        </mesh>
        <mesh position={[TUBE.length * 0.72, AXIS + TUBE.radius + 0.012, 0]}>
          <sphereGeometry args={[0.028, 16, 12]} />
          <Matter
            color={APPARATUS_COLORS.counterLed}
            glow={0.025}
            of="epoxy"
            ref={lamp}
          />
        </mesh>
        {Arr.map([0.25, 0.9] as const, (x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh castShadow position={[0, 0.02, 0]} receiveShadow>
              <boxGeometry args={[0.2, 0.04, 0.5]} />
              <Matter of="steel" />
            </mesh>
            <mesh castShadow position={[0, (AXIS - TUBE.radius) / 2, 0]}>
              <boxGeometry args={[0.07, AXIS - TUBE.radius, 0.2]} />
              <Matter of="steel" />
            </mesh>
          </group>
        ))}
      </group>
      <group ref={swarm}>
        {Arr.map(flights, (flight) => (
          <mesh key={flight.key} scale={[0.07, 0.012, 0.012]}>
            <sphereGeometry args={[1, 10, 8]} />
            <Matter color={APPARATUS_COLORS.betaTrack} glow={0.8} of="light" />
          </mesh>
        ))}
      </group>
      <group ref={strays}>
        {Arr.map(crossings, (crossing) => (
          <mesh key={crossing.key}>
            <sphereGeometry args={[0.016, 10, 8]} />
            <Matter
              color={APPARATUS_COLORS.neutronFree}
              glow={0.6}
              of="light"
            />
          </mesh>
        ))}
      </group>
      <Lead color={APPARATUS_COLORS.leadBlack} points={CABLE} radius={0.024} />
      <group position={METER_AT} scale={1.5}>
        <Meter share={rate / full}>
          <InlineMath math={`R=${quantity(rate, "\\text{ min}^{-1}", 0)}`} />
        </Meter>
      </group>
    </group>
  );
}
