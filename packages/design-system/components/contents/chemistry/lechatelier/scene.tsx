import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import {
  CatalystGauze,
  InjectionSyringe,
  ThermalCoil,
} from "@repo/design-system/components/contents/chemistry/lechatelier/apparatus";
import {
  CYLINDER_BOTTOM,
  CYLINDER_INNER_R,
  CYLINDER_Z,
  PistonAssembly,
  ReactionCylinder,
  RetortStand,
  SEPTUM_Y,
} from "@repo/design-system/components/contents/chemistry/lechatelier/geometry";
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
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

const MAX_MOLECULES = 36;
const BASE_MOLECULES = 24;

function PistonCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.03, 0.41, 1.24] : [0.03, 0.34, 0.94]}
      cameraTarget={[0.02, 0.21, 0.04]}
      fov={37}
      maxDistance={2.2}
      minDistance={0.35}
    />
  );
}

function thermalModeFor(
  disturbance: Disturbance,
  intensity: number
): "cold" | "hot" | "neutral" {
  if (disturbance !== "temperature" || Math.abs(intensity) < 0.08) {
    return "neutral";
  }
  return intensity > 0 ? "hot" : "cold";
}

function speciesColorsFor(system: LeChatelierSystem) {
  if (system === "nitrogenDioxide") {
    return {
      hazeColor: EQUILIBRIUM_COLORS.no2Brown,
      productColor: EQUILIBRIUM_COLORS.no2Brown,
      reactantColor: EQUILIBRIUM_COLORS.n2o4Pale,
    };
  }
  if (system === "contact") {
    return {
      hazeColor: PROCESS_COLORS.oleumAmber,
      productColor: PROCESS_COLORS.vanadiumOrange,
      reactantColor: EQUILIBRIUM_COLORS.reactant,
    };
  }
  return {
    hazeColor: PROCESS_COLORS.ammoniaCyan,
    productColor: EQUILIBRIUM_COLORS.product,
    reactantColor: EQUILIBRIUM_COLORS.reactant,
  };
}

function GasChamber({
  activeCount,
  catalystActive,
  disturbance,
  hazeColor,
  hazeOpacity,
  intensity,
  pistonY,
  playing,
  productColor,
  productCount,
  reactantColor,
  system,
}: {
  readonly activeCount: number;
  readonly catalystActive: boolean;
  readonly disturbance: Disturbance;
  readonly hazeColor: string;
  readonly hazeOpacity: number;
  readonly intensity: number;
  readonly pistonY: number;
  readonly playing: boolean;
  readonly productColor: string;
  readonly productCount: number;
  readonly reactantColor: string;
  readonly system: LeChatelierSystem;
}) {
  const swarmRef = useRef<Group>(null);
  const pulseRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  const particles = useMemo(
    () =>
      Arr.makeBy(MAX_MOLECULES, (index) => ({
        angle: index * 2.399_96,
        id: index,
        level: ((index * 17 + 3) % 19) / 19,
        radius: 0.012 + ((index * 11) % 9) * 0.0052,
      })),
    []
  );

  const tempSpeed =
    disturbance === "temperature" ? Math.max(0.45, 1 + intensity * 0.65) : 1;
  const pressSpeed =
    disturbance === "pressure" ? Math.max(0.65, 1 + intensity * 0.35) : 1;
  const speed = (catalystActive ? 2.4 : 0.85) * tempSpeed * pressSpeed;

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    const dt = simulationStep(delta);
    phaseRef.current += dt * speed;
    if (swarmRef.current !== null) {
      swarmRef.current.rotation.y += dt * speed * 0.9;
      swarmRef.current.position.y = Math.sin(phaseRef.current * 2.2) * 0.004;
    }
    if (pulseRef.current !== null) {
      const flowT = (phaseRef.current * 0.85) % 1;
      const dir = intensity >= 0 ? 1 - flowT : flowT;
      pulseRef.current.position.x = 0.025 + dir * 0.058;
    }
  });

  const chamberFloor = CYLINDER_BOTTOM + 0.012;
  const chamberCeil = Math.max(chamberFloor + 0.06, pistonY - 0.018);
  const chamberHeight = chamberCeil - chamberFloor;
  const showInjectPulse =
    disturbance === "concentration" && Math.abs(intensity) >= 0.08;

  return (
    <group position={[0, 0, CYLINDER_Z]}>
      {/* Volumetric gas haze tint inside reaction chamber */}
      <mesh position={[0, chamberFloor + chamberHeight / 2, 0]}>
        <cylinderGeometry
          args={[
            CYLINDER_INNER_R - 0.003,
            CYLINDER_INNER_R - 0.003,
            chamberHeight,
            32,
          ]}
        />
        <meshStandardMaterial
          color={hazeColor}
          depthWrite={false}
          opacity={hazeOpacity}
          roughness={0.9}
          transparent
        />
      </mesh>
      {/* Injection stream pulse at septum port when concentration changes */}
      {showInjectPulse ? (
        <group position={[0.055, SEPTUM_Y, 0]} ref={pulseRef}>
          <mesh>
            <sphereGeometry args={[0.0055, 12, 10]} />
            <meshStandardMaterial
              color={reactantColor}
              emissive={reactantColor}
              emissiveIntensity={0.85}
            />
          </mesh>
        </group>
      ) : null}
      {/* Gas molecules bounded below piston */}
      <group ref={swarmRef}>
        {Arr.map(Arr.take(particles, activeCount), (pt) => {
          const y = chamberFloor + 0.008 + pt.level * (chamberHeight - 0.016);
          const isProduct = pt.id < productCount;
          const color = isProduct ? productColor : reactantColor;
          const isDimer = system === "nitrogenDioxide" && !isProduct;
          const x = Math.cos(pt.angle) * pt.radius;
          const z = Math.sin(pt.angle) * pt.radius;
          return (
            <group key={pt.id} position={[x, y, z]}>
              <mesh castShadow>
                <sphereGeometry args={[isDimer ? 0.0062 : 0.0054, 12, 10]} />
                <meshStandardMaterial
                  color={color}
                  emissive={color}
                  emissiveIntensity={0.28}
                  roughness={0.32}
                />
              </mesh>
              {isDimer ? (
                <mesh position={[0.0068, 0.0018, 0]}>
                  <sphereGeometry args={[0.0056, 10, 8]} />
                  <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={0.22}
                    roughness={0.34}
                  />
                </mesh>
              ) : null}
            </group>
          );
        })}
      </group>
    </group>
  );
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
  const labelInk = useLabelInk();
  const clamped = Math.max(-1, Math.min(1, intensity));
  const pistonY = disturbance === "pressure" ? 0.215 - clamped * 0.06 : 0.228;
  const activeCount =
    disturbance === "concentration"
      ? Math.max(
          10,
          Math.min(MAX_MOLECULES, Math.round(BASE_MOLECULES + clamped * 12))
        )
      : BASE_MOLECULES;
  const catalystActive = disturbance === "catalyst" && intensity > 0;
  const thermalMode = thermalModeFor(disturbance, clamped);
  const { hazeColor, productColor, reactantColor } = speciesColorsFor(system);
  const productCount = Math.round((yieldPercent / 100) * activeCount);
  const hazeOpacity =
    system === "nitrogenDioxide"
      ? 0.08 + (yieldPercent / 100) * 0.38
      : 0.05 + (yieldPercent / 100) * 0.14;

  return (
    <group>
      <SimulationTicker running={playing} />
      <PistonCamera />
      <LabBench width={2.6} />
      <RetortStand />
      <ReactionCylinder />
      <ThermalCoil activeMode={thermalMode} intensity={clamped} />
      <PistonAssembly pistonY={pistonY} />
      <InjectionSyringe
        active={disturbance === "concentration"}
        intensity={clamped}
        reagentColor={reactantColor}
      />
      {catalystActive ? <CatalystGauze /> : null}
      <GasChamber
        activeCount={activeCount}
        catalystActive={catalystActive}
        disturbance={disturbance}
        hazeColor={hazeColor}
        hazeOpacity={hazeOpacity}
        intensity={clamped}
        pistonY={pistonY}
        playing={playing}
        productColor={productColor}
        productCount={productCount}
        reactantColor={reactantColor}
        system={system}
      />
      {enthalpyLabel.length > 0 ? (
        <ThreeLabel
          color={labelInk}
          fontSize="compact"
          position={[0.02, 0.395, CYLINDER_Z + 0.02]}
        >
          <span>{enthalpyLabel}</span>
        </ThreeLabel>
      ) : null}
      {catalystActive ? (
        <ThreeLabel
          color={labelInk}
          fontSize="compact"
          position={[0.175, 0.045, CYLINDER_Z + 0.06]}
        >
          <span>{catalystLabel}</span>
        </ThreeLabel>
      ) : null}
    </group>
  );
}
