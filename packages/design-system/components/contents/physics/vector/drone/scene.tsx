import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { VectorArrowHandle } from "@repo/design-system/components/contents/physics/solid/arrow";
import { VectorArrow } from "@repo/design-system/components/contents/physics/solid/arrow";
import type { Hop } from "@repo/design-system/components/contents/physics/vector/drone/flight";
import {
  hopCorners,
  hopPoint,
  pathLength,
} from "@repo/design-system/components/contents/physics/vector/drone/flight";
import { FixedArrow } from "@repo/design-system/components/contents/physics/vector/solid/arrow";
import { Guide } from "@repo/design-system/components/contents/physics/vector/solid/guide";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import type { CoordinateTuple } from "@repo/design-system/components/three/frame";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { getColor } from "@repo/design-system/lib/color";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { ROAD_COLORS } from "@repo/design-system/lib/material/road";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";
import { Vector3 } from "three";

/** How fast the drone flies its path, in m/s. */
const FLIGHT_SPEED = 3;

/** How long the drone hovers at the end before it flies again, in seconds. */
const HOVER = 2;

/** The diagonal of a camera drone from motor to motor, in metres. */
const DIAGONAL = 0.35;

/** Where the four motors stand around the body, with the LED each arm carries: red forward, green aft. */
const MOTORS = Arr.map([45, 135, 225, 315], (angle) => {
  const turn = (angle * Math.PI) / 180;
  const reach = DIAGONAL / 2;
  return {
    angle: turn,
    forward: Math.cos(turn) > 0,
    x: Math.cos(turn) * reach,
    z: Math.sin(turn) * reach,
  };
});

/** A place east, north and up as a scene point: east is +x, up is +y, north is -z. */
function scenePoint(place: Hop) {
  return [place.east, place.up, -place.north] satisfies CoordinateTuple;
}

/** One two-blade propeller: tapered blades with their pitch, and the faint disc they sweep while they spin. */
function Propeller({ spin }: { readonly spin: (group: Group | null) => void }) {
  const blur = useVisualScene((card) => card.playing, false);
  return (
    <group ref={spin}>
      {Arr.map([0, Math.PI], (turn) => (
        <mesh
          castShadow
          key={turn}
          position={[Math.cos(turn) * 0.05, 0, Math.sin(turn) * 0.05]}
          rotation={[0.18, -turn, 0]}
          scale={[0.05, 0.0025, 0.011]}
        >
          <sphereGeometry args={[1, 16, 8]} />
          <SurfaceMaterial color={MACHINE_COLORS.propeller} surface="plastic" />
        </mesh>
      ))}
      {blur ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.1, 32]} />
          <meshStandardMaterial
            color={MACHINE_COLORS.propeller}
            depthWrite={false}
            opacity={0.14}
            transparent
          />
        </mesh>
      ) : null}
    </group>
  );
}

/**
 * A folding camera drone of about 35 cm diagonal: a streamlined grey shell,
 * four tapered arms out to brushed motor bells, two-blade propellers with
 * their pitch, slim landing legs, the camera on its gimbal under the nose,
 * forward obstacle sensors, and red LEDs on the front arms and green on the
 * rear. Its nose points east, +x.
 */
function Quadcopter({
  spin,
}: {
  readonly spin: (index: number) => (group: Group | null) => void;
}) {
  return (
    <group>
      <mesh castShadow scale={[0.11, 0.04, 0.055]}>
        <sphereGeometry args={[1, 32, 20]} />
        <SurfaceMaterial color={MACHINE_COLORS.carbonShell} surface="plastic" />
      </mesh>
      <mesh castShadow position={[-0.01, 0.028, 0]} scale={[0.08, 0.02, 0.042]}>
        <sphereGeometry args={[1, 28, 16]} />
        <SurfaceMaterial color={CAR_COLORS.hub} surface="plastic" />
      </mesh>
      {Arr.map([-1, 1], (side) => (
        <mesh key={side} position={[0.104, 0.008, side * 0.016]}>
          <sphereGeometry args={[0.006, 10, 8]} />
          <meshStandardMaterial
            color={CAR_COLORS.tintedGlass}
            metalness={0.4}
            roughness={0.05}
          />
        </mesh>
      ))}
      {Arr.map(MOTORS, (motor, index) => (
        <group key={motor.angle}>
          <mesh
            castShadow
            position={[motor.x / 2, -0.004, motor.z / 2]}
            rotation={[0, -motor.angle, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.007, 0.011, DIAGONAL / 2, 10]} />
            <SurfaceMaterial
              color={MACHINE_COLORS.carbonShell}
              surface="plastic"
            />
          </mesh>
          <mesh castShadow position={[motor.x, 0.006, motor.z]}>
            <cylinderGeometry args={[0.013, 0.014, 0.022, 18]} />
            <SurfaceMaterial
              color={CAR_COLORS.castIron}
              metalness={1}
              roughness={0.5}
              surface="brushed"
            />
          </mesh>
          <mesh castShadow position={[motor.x, -0.03, motor.z]}>
            <cylinderGeometry args={[0.003, 0.004, 0.05, 6]} />
            <SurfaceMaterial
              color={MACHINE_COLORS.carbonShell}
              surface="plastic"
            />
          </mesh>
          <mesh position={[motor.x, -0.012, motor.z]}>
            <sphereGeometry args={[0.004, 8, 6]} />
            <meshStandardMaterial
              color={
                motor.forward
                  ? MACHINE_COLORS.signalRed
                  : MACHINE_COLORS.signalGreen
              }
              emissive={
                motor.forward
                  ? MACHINE_COLORS.signalRed
                  : MACHINE_COLORS.signalGreen
              }
              emissiveIntensity={3}
            />
          </mesh>
          <group position={[motor.x, 0.02, motor.z]}>
            <Propeller spin={spin(index)} />
          </group>
        </group>
      ))}
      <group position={[0.1, -0.035, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.012, 0.02, 0.03]} />
          <SurfaceMaterial color={CAR_COLORS.hub} surface="plastic" />
        </mesh>
        <mesh castShadow position={[0.008, -0.02, 0]}>
          <boxGeometry args={[0.024, 0.022, 0.026]} />
          <SurfaceMaterial
            color={MACHINE_COLORS.carbonShell}
            surface="plastic"
          />
        </mesh>
        <mesh position={[0.021, -0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.008, 0.008, 0.004, 16]} />
          <meshStandardMaterial
            color={CAR_COLORS.tintedGlass}
            metalness={0.5}
            roughness={0.04}
          />
        </mesh>
      </group>
    </group>
  );
}

/** A folding landing pad on the grass: an orange disc with a white ring and the H drones land on. */
function Pad() {
  return (
    <group>
      <mesh position={[0, 0.004, 0]} receiveShadow>
        <cylinderGeometry args={[0.55, 0.55, 0.006, 64]} />
        <SurfaceMaterial
          color={MACHINE_COLORS.padOrange}
          repeat={[4, 4]}
          surface="cloth"
        />
      </mesh>
      <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.4, 0.45, 64]} />
        <meshStandardMaterial color={ROAD_COLORS.roadPaint} roughness={0.8} />
      </mesh>
      {Arr.map(
        [
          { args: [0.05, 0.002, 0.34], at: [-0.1, 0] },
          { args: [0.05, 0.002, 0.34], at: [0.1, 0] },
          { args: [0.2, 0.002, 0.05], at: [0, 0] },
        ] as const,
        (bar) => (
          <mesh
            key={`${bar.at[0]}-${bar.args[0]}`}
            position={[bar.at[0], 0.008, bar.at[1]]}
          >
            <boxGeometry args={bar.args} />
            <meshStandardMaterial
              color={ROAD_COLORS.roadPaint}
              roughness={0.8}
            />
          </mesh>
        )
      )}
    </group>
  );
}

/**
 * The flight from the pad: the dashed path, the drone flying it and
 * hovering at the end, the displacement from the pad to the drone (violet),
 * and its three components laid tip to tail east, north and up.
 */
export function DroneScene({
  hops,
  units,
}: {
  readonly hops: readonly [Hop, ...Hop[]];
  readonly units: boolean;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const drone = useRef<Group>(null);
  const rotors = useRef<(Group | null)[]>([]);
  const spin = (index: number) => (group: Group | null) => {
    rotors.current[index] = group;
  };
  const time = useRef(Number.POSITIVE_INFINITY);
  const reach = useRef<VectorArrowHandle>(null);
  const east = useRef<VectorArrowHandle>(null);
  const north = useRef<VectorArrowHandle>(null);
  const up = useRef<VectorArrowHandle>(null);
  const from = useRef(new Vector3());
  const vector = useRef(new Vector3());
  const length = pathLength(hops);
  const duration = length / FLIGHT_SPEED;
  const corners = Arr.map(hopCorners(hops), scenePoint);
  // A real drone would be a speck over a flight this long, so it is drawn larger than life, by a share of the path.
  const legible = Math.max(4, length / 3.2);

  useVisualStop(() => {
    time.current = 0;
  });

  useFrame((_, delta) => {
    if (playing) {
      time.current = Math.min(time.current, duration) + Math.min(delta, 0.1);
      if (time.current > duration + HOVER) {
        time.current = 0;
      }
    }
    const at = hopPoint(hops, Math.min(time.current, duration) * FLIGHT_SPEED);
    const [x, y, z] = scenePoint(at);
    drone.current?.position.set(x, y + 0.05 * legible, z);
    if (playing) {
      for (const rotor of rotors.current) {
        if (rotor !== null) {
          rotor.rotation.y += Math.min(delta, 0.1) * 60;
        }
      }
    }
    reach.current?.set(
      from.current.set(0, 0.02, 0),
      vector.current.set(x, y, z)
    );
    east.current?.set(
      from.current.set(0, 0.02, 0),
      vector.current.set(x, 0, 0)
    );
    north.current?.set(
      from.current.set(x, 0.02, 0),
      vector.current.set(0, 0, z)
    );
    up.current?.set(from.current.set(x, 0.02, z), vector.current.set(0, y, 0));
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <group scale={legible / 2}>
        <Pad />
      </group>
      <Line
        color={getColor("WHITE")}
        dashed
        dashSize={0.4}
        gapSize={0.3}
        lineWidth={2}
        opacity={0.85}
        points={corners}
        transparent
      />
      <group ref={drone} scale={legible}>
        <Quadcopter spin={spin} />
      </group>
      <Guide>
        <VectorArrow
          color={PLOT_COLORS.teal}
          head={0.5}
          ref={east}
          thickness={0.07}
        />
        <VectorArrow
          color={PLOT_COLORS.amber}
          head={0.5}
          ref={north}
          thickness={0.07}
        />
        <VectorArrow
          color={PLOT_COLORS.fuchsia}
          head={0.5}
          ref={up}
          thickness={0.07}
        />
        <VectorArrow
          color={PLOT_COLORS.violet}
          head={0.6}
          ref={reach}
          thickness={0.1}
        />
      </Guide>
      {units ? <UnitArrows /> : null}
    </group>
  );
}

/** The three unit vectors at the pad, one metre each, east, north and up. */
function UnitArrows() {
  const units = [
    {
      color: PLOT_COLORS.teal,
      label: { east: 1.45, north: 0, up: 0 },
      math: "\\hat{\\imath}",
      to: { east: 1, north: 0, up: 0 },
    },
    {
      color: PLOT_COLORS.amber,
      label: { east: 0.45, north: 1.6, up: 0 },
      math: "\\hat{\\jmath}",
      to: { east: 0, north: 1, up: 0 },
    },
    {
      color: PLOT_COLORS.fuchsia,
      label: { east: -0.4, north: 0, up: 1.45 },
      math: "\\hat{k}",
      to: { east: 0, north: 0, up: 1 },
    },
  ] as const;
  return (
    <group position={[-1.4, 0.03, 1.4]}>
      {Arr.map(units, (unit) => (
        <group key={unit.math}>
          <FixedArrow
            color={unit.color}
            from={[0, 0, 0]}
            head={0.22}
            thickness={0.035}
            vector={scenePoint(unit.to)}
          />
          <ThreeLabel
            color={unit.color}
            fontSize="reading"
            position={scenePoint(unit.label)}
          >
            <InlineMath math={unit.math} />
          </ThreeLabel>
        </group>
      ))}
    </group>
  );
}
