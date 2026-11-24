import { useFrame, useThree } from "@react-three/fiber";
import type {
  Disturbance,
  LeChatelierSystem,
} from "@repo/design-system/components/contents/chemistry/lechatelier/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { EQUILIBRIUM_COLORS } from "@repo/design-system/lib/material/equilibrium";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

const MOLECULE_COUNT = 22;

function PistonCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.95, 3.95] : [0, 1.55, 3.1]}
      cameraTarget={[0, 0.65, 0]}
      fov={38}
      maxDistance={6.2}
      minDistance={1.5}
    />
  );
}

function coilColorFor(disturbance: Disturbance, intensity: number) {
  if (disturbance !== "temperature" || Math.abs(intensity) < 0.08) {
    return EQUILIBRIUM_COLORS.coilNeutral;
  }
  return intensity > 0
    ? EQUILIBRIUM_COLORS.coilHot
    : EQUILIBRIUM_COLORS.coilCold;
}

export function LeChatelierScene({
  catalystLabel,
  disturbance,
  enthalpyLabel,
  intensity,
  system,
  yieldPercent,
}: {
  readonly catalystLabel: string;
  readonly disturbance: Disturbance;
  readonly enthalpyLabel: string;
  readonly intensity: number;
  readonly system: LeChatelierSystem;
  readonly yieldPercent: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const swarmRef = useRef<Group>(null);
  const particles = useMemo(
    () =>
      Arr.makeBy(MOLECULE_COUNT, (index) => ({
        angle: index * 2.399_96,
        id: index,
        level: ((index * 13) % 10) / 10,
        radius: 0.16 + ((index * 7) % 8) * 0.068,
      })),
    []
  );

  const pistonHeight =
    disturbance === "pressure" ? 1.04 - intensity * 0.32 : 1.04;
  const productCount = Math.round((yieldPercent / 100) * MOLECULE_COUNT);
  const catalystActive = disturbance === "catalyst" && intensity > 0;
  const coilColor = coilColorFor(disturbance, intensity);
  const speed = catalystActive ? 1.8 : 0.75;

  useFrame((_, delta) => {
    if (swarmRef.current === null || !playing) {
      return;
    }
    swarmRef.current.rotation.y += simulationStep(delta) * speed;
  });

  const productColor =
    system === "nitrogenDioxide"
      ? EQUILIBRIUM_COLORS.no2Brown
      : EQUILIBRIUM_COLORS.product;
  const reactantColor =
    system === "nitrogenDioxide"
      ? EQUILIBRIUM_COLORS.n2o4Pale
      : EQUILIBRIUM_COLORS.reactant;

  return (
    <group>
      <SimulationTicker running={playing} />
      <PistonCamera />
      {/* Thermal heater / cooler coil */}
      <mesh position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.74, 0.055, 12, 32]} />
        <meshStandardMaterial color={coilColor} roughness={0.4} />
      </mesh>
      {/* Glass cylinder */}
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.76, 0.76, 1.24, 32]} />
        <meshPhysicalMaterial
          color={EQUILIBRIUM_COLORS.vesselGlass}
          opacity={0.24}
          roughness={0.14}
          transparent
        />
      </mesh>
      {/* Movable piston */}
      <group position={[0, pistonHeight, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.72, 0.72, 0.12, 28]} />
          <meshStandardMaterial
            color={EQUILIBRIUM_COLORS.pistonMetal}
            metalness={0.62}
            roughness={0.32}
          />
        </mesh>
        <mesh castShadow position={[0, 0.34, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.56, 16]} />
          <meshStandardMaterial
            color={EQUILIBRIUM_COLORS.pistonRod}
            metalness={0.55}
            roughness={0.35}
          />
        </mesh>
      </group>
      {/* Optional catalyst mesh */}
      {catalystActive ? (
        <group position={[0, 0.24, 0]}>
          <mesh>
            <cylinderGeometry args={[0.66, 0.66, 0.03, 24]} />
            <meshStandardMaterial
              color={EQUILIBRIUM_COLORS.catalystMesh}
              metalness={0.5}
              roughness={0.38}
              wireframe
            />
          </mesh>
          <ThreeLabel
            color={EQUILIBRIUM_COLORS.labelInk}
            fontSize="compact"
            position={[0.92, 0.04, 0]}
          >
            <span>{catalystLabel}</span>
          </ThreeLabel>
        </group>
      ) : null}
      {/* Gas particles bounded below piston */}
      <group ref={swarmRef}>
        {Arr.map(particles, (pt) => {
          const y = 0.2 + pt.level * Math.max(0.28, pistonHeight - 0.34);
          const isProduct = pt.id < productCount;
          return (
            <mesh
              castShadow
              key={pt.id}
              position={[
                Math.cos(pt.angle) * pt.radius,
                y,
                Math.sin(pt.angle) * pt.radius,
              ]}
            >
              <sphereGeometry args={[0.052, 12, 10]} />
              <meshStandardMaterial
                color={isProduct ? productColor : reactantColor}
                roughness={0.4}
              />
            </mesh>
          );
        })}
      </group>
      <ThreeLabel
        color={EQUILIBRIUM_COLORS.labelInk}
        fontSize="compact"
        position={[-0.95, 0.16, 0.2]}
      >
        <span>{enthalpyLabel}</span>
      </ThreeLabel>
    </group>
  );
}
