import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { mix } from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  VectorArrow,
  type VectorArrowHandle,
} from "@repo/design-system/components/contents/physics/solid/arrow";
import {
  type Hop,
  hopCorners,
  hopPoint,
  pathLength,
} from "@repo/design-system/components/contents/physics/vector/drone/flight";
import { FixedArrow } from "@repo/design-system/components/contents/physics/vector/solid/arrow";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import type { CoordinateTuple } from "@repo/design-system/components/three/frame";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { type Ref, useRef } from "react";
import { type Group, Vector3 } from "three";

/** How fast the drone flies its path, in m/s. */
const FLIGHT_SPEED = 3;

/** How long the drone hovers at the end before it flies again, in seconds. */
const HOVER = 2;

/** The span of the drone from rotor tip to rotor tip, in metres, drawn larger than a real one so it reads at this distance. */
const SPAN = 0.9;

/** A place east, north and up as a scene point: east is +x, up is +y, north is -z. */
export function scenePoint(place: Hop) {
  return [place.east, place.up, -place.north] satisfies CoordinateTuple;
}

/** The quadcopter: a carbon shell, four arms with motors and spinning rotors, and a camera underneath. */
function Quadcopter({ rotors }: { readonly rotors: Ref<Group> }) {
  const arm = SPAN / 2 - 0.08;
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[0.26, 0.08, 0.34]} />
        <meshStandardMaterial
          color={MATERIAL.carbonShell}
          metalness={0.3}
          roughness={0.45}
        />
      </mesh>
      <mesh castShadow position={[0, -0.07, -0.12]}>
        <sphereGeometry args={[0.045, 20, 16]} />
        <meshStandardMaterial
          color={MATERIAL.tintedGlass}
          metalness={0.6}
          roughness={0.15}
        />
      </mesh>
      <group ref={rotors}>
        {Arr.map([45, 135, 225, 315], (angle) => {
          const turn = (angle * Math.PI) / 180;
          const x = Math.cos(turn) * arm;
          const z = Math.sin(turn) * arm;
          return (
            <group key={angle}>
              <mesh
                castShadow
                position={[x / 2, 0, z / 2]}
                rotation={[0, -turn, 0]}
              >
                <boxGeometry args={[arm, 0.025, 0.035]} />
                <meshStandardMaterial
                  color={MATERIAL.carbonShell}
                  roughness={0.5}
                />
              </mesh>
              <mesh castShadow position={[x, 0.03, z]}>
                <cylinderGeometry args={[0.03, 0.03, 0.05, 16]} />
                <meshStandardMaterial
                  color={MATERIAL.propeller}
                  metalness={0.5}
                  roughness={0.4}
                />
              </mesh>
              <mesh name="rotor" position={[x, 0.06, z]}>
                <boxGeometry args={[0.3, 0.004, 0.03]} />
                <meshStandardMaterial
                  color={MATERIAL.propeller}
                  roughness={0.5}
                />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}

/** A mown meadow around the pad: stripes of grass in two shades, as a mower leaves them. */
function Meadow() {
  return (
    <group>
      {Arr.makeBy(14, (index) => (
        <mesh
          key={index}
          position={[(index - 6.5) * 3, 0.002, -4]}
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[3, 44]} />
          <meshStandardMaterial
            color={
              index % 2 === 0
                ? mix(MATERIAL.grass, MATERIAL.foliageLight, 0.35)
                : mix(MATERIAL.grass, MATERIAL.foliageDark, 0.25)
            }
            roughness={0.95}
          />
        </mesh>
      ))}
    </group>
  );
}

/** The launch pad: a round rubber mat on the grass with a pale ring. */
function Pad() {
  return (
    <group>
      <mesh position={[0, 0.006, 0]} receiveShadow>
        <cylinderGeometry args={[0.75, 0.75, 0.012, 48]} />
        <meshStandardMaterial color={MATERIAL.asphalt} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.013, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.58, 48]} />
        <meshStandardMaterial color={MATERIAL.roadPaint} roughness={0.8} />
      </mesh>
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
  const rotors = useRef<Group>(null);
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

  useFrame((_, delta) => {
    if (playing) {
      time.current = Math.min(time.current, duration) + Math.min(delta, 0.1);
      if (time.current > duration + HOVER) {
        time.current = 0;
      }
    }
    const at = hopPoint(hops, Math.min(time.current, duration) * FLIGHT_SPEED);
    const [x, y, z] = scenePoint(at);
    drone.current?.position.set(x, y + 0.12, z);
    for (const rotor of rotors.current?.getObjectsByProperty("name", "rotor") ??
      []) {
      rotor.rotation.y += playing ? Math.min(delta, 0.1) * 40 : 0;
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
      <Meadow />
      <Pad />
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
      <group ref={drone}>
        <Quadcopter rotors={rotors} />
      </group>
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
      {units ? <UnitArrows /> : null}
    </group>
  );
}

/** The three unit vectors at the pad, one metre each, east, north and up. */
function UnitArrows() {
  const units = [
    {
      color: PLOT_COLORS.teal,
      math: "\\hat{\\imath}",
      to: { east: 1, north: 0, up: 0 },
    },
    {
      color: PLOT_COLORS.amber,
      math: "\\hat{\\jmath}",
      to: { east: 0, north: 1, up: 0 },
    },
    {
      color: PLOT_COLORS.fuchsia,
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
            position={scenePoint({
              east: unit.to.east * 1.35,
              north: unit.to.north * 1.35,
              up: unit.to.up * 1.35,
            })}
          >
            <InlineMath math={unit.math} />
          </ThreeLabel>
        </group>
      ))}
    </group>
  );
}
