import { useFrame, useThree } from "@react-three/fiber";
import { PeaSeed } from "@repo/design-system/components/contents/biology/botany";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  leafBlade,
  useFoliageMaterial,
} from "@repo/design-system/components/contents/biology/flora";
import type { VariationKind } from "@repo/design-system/components/contents/biology/variation/model";
import { evaluateVariationBars } from "@repo/design-system/components/contents/biology/variation/model";
import {
  BiologyBenchSurface,
  SpecimenPedestal,
} from "@repo/design-system/components/contents/biology/workbench";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import {
  useVisualReset,
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { GENETICS_COLORS } from "@repo/design-system/lib/material/genetics";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { CatmullRomCurve3, Color, TubeGeometry, Vector3 } from "three";

function VariationCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.66, 3.92] : [0, 1.4, 3.35]}
      cameraTarget={[0, 0.58, 0]}
      fov={38}
      maxDistance={6.4}
      minDistance={1.4}
    />
  );
}

/** One graduated botanical leaf specimen mounted atop a continuous biometric column. */
function GraduatedLeafSpecimen({
  length,
  position,
}: {
  readonly length: number;
  readonly position: readonly [number, number, number];
}) {
  const foliageMaterial = useFoliageMaterial();
  const geo = useMemo(
    () =>
      leafBlade(
        new Vector3(0, 0, 0),
        0,
        1.2,
        length,
        length * 0.42,
        0.18,
        6,
        new Color(GENETICS_COLORS.tallLeaf),
        new Color(BIOLOGY_COLORS.leafUnder)
      ),
    [length]
  );

  useEffect(() => () => geo.dispose(), [geo]);

  return (
    <mesh
      castShadow
      geometry={geo}
      material={foliageMaterial}
      position={position}
    />
  );
}

/** Sculpted frosted-glass & brushed-brass biometric specimen column (zero flat rectangular bars). */
function BiometricGlassColumn({
  accentColor,
  height,
  position,
  radius,
}: {
  readonly accentColor: string;
  readonly height: number;
  readonly position: readonly [number, number, number];
  readonly radius: number;
}) {
  return (
    <group position={position}>
      {/* Brass collar base */}
      <mesh castShadow position={[0, 0.015, 0]} receiveShadow>
        <cylinderGeometry args={[radius * 1.12, radius * 1.22, 0.03, 24]} />
        <MetalMaterial color={GENETICS_COLORS.brassPolished} roughness={0.28} />
      </mesh>
      {/* Translucent frosted-glass frequency cylinder */}
      <mesh castShadow position={[0, 0.03 + height * 0.5, 0]} receiveShadow>
        <cylinderGeometry args={[radius, radius, height, 24]} />
        <meshPhysicalMaterial
          clearcoat={0.86}
          clearcoatRoughness={0.14}
          color={accentColor}
          opacity={0.76}
          roughness={0.18}
          transparent
        />
      </mesh>
      {/* Glowing internal biometric core rod */}
      <mesh position={[0, 0.03 + height * 0.5, 0]}>
        <cylinderGeometry
          args={[radius * 0.36, radius * 0.36, height * 0.92, 16]}
        />
        <meshPhysicalMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={0.32}
          roughness={0.24}
        />
      </mesh>
      {/* Brass top specimen ring */}
      <mesh castShadow position={[0, 0.035 + height, 0]}>
        <cylinderGeometry args={[radius * 1.08, radius * 1.08, 0.016, 24]} />
        <MetalMaterial color={GENETICS_COLORS.brassPolished} roughness={0.24} />
      </mesh>
    </group>
  );
}

export function VariationDistributionScene({
  genePairs,
  kind,
  parts,
}: {
  readonly genePairs: number;
  readonly kind: VariationKind;
  readonly parts: Readonly<
    Record<"bellCurve" | "discreteBars" | "environment" | "meanLine", string>
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const invalidate = useThree((state) => state.invalidate);
  const ink = useLabelInk();
  const stageRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const bars = evaluateVariationBars(kind, genePairs);

  const rewind = () => {
    phaseRef.current = 0;
    if (stageRef.current !== null) {
      stageRef.current.rotation.set(0, 0, 0);
    }
    invalidate();
  };

  useVisualStop(rewind);
  useVisualReset(rewind);

  useFrame((_, delta) => {
    if (!playing || stageRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 0.55;
    stageRef.current.rotation.y = Math.sin(phaseRef.current) * 0.16;
  });

  // Sweeping 3D normal bell-curve brass/sapphire arch above continuous biometric columns
  const bellCurveGeo = useMemo(() => {
    if (kind !== "continuous" || bars.length < 2) {
      return null;
    }
    const pts = Arr.map(
      bars,
      (bar) => new Vector3(bar.x, 0.14 + bar.height + 0.08, 0.16)
    );
    return new TubeGeometry(new CatmullRomCurve3(pts), 48, 0.014, 10, false);
  }, [bars, kind]);

  useEffect(() => () => bellCurveGeo?.dispose(), [bellCurveGeo]);

  const colRadius =
    kind === "continuous" ? Math.min(0.082, 0.64 / bars.length) : 0.115;

  return (
    <group>
      <SimulationTicker running={playing} />
      <VariationCamera />
      <BiologyBenchSurface radius={14} y={0} />

      <group ref={stageRef}>
        <SpecimenPedestal depth={0.94} height={0.055} width={2.48} />

        {/* Graduated brushed-brass biometric ruler ticks along the front plinth edge */}
        {Arr.makeBy(11, (i) => {
          const tickX = -1.0 + i * 0.2;
          return (
            <mesh
              key={`tick-${tickX.toFixed(2)}`}
              position={[tickX, 0.098, 0.39]}
            >
              <boxGeometry args={[0.008, 0.006, i % 2 === 0 ? 0.065 : 0.038]} />
              <MetalMaterial
                color={GENETICS_COLORS.brassPolished}
                roughness={0.28}
              />
            </mesh>
          );
        })}

        {/* Frosted-glass & brass biometric frequency columns + real biological specimens */}
        {Arr.map(bars, (bar, idx) => {
          const leafScale = 0.12 + (idx / Math.max(1, bars.length - 1)) * 0.18;
          return (
            <group key={bar.id}>
              <BiometricGlassColumn
                accentColor={
                  kind === "continuous"
                    ? GENETICS_COLORS.bellCurveBlue
                    : GENETICS_COLORS.discreteViolet
                }
                height={bar.height}
                position={[bar.x, 0.092, 0]}
                radius={colRadius}
              />
              {kind === "continuous" ? (
                <GraduatedLeafSpecimen
                  length={leafScale}
                  position={[bar.x, 0.135 + bar.height, 0]}
                />
              ) : (
                <PeaSeed
                  isWrinkled={idx % 2 === 1}
                  isYellow={idx < 2}
                  position={[bar.x, 0.185 + bar.height, 0]}
                  scale={0.78}
                  seed={idx + 11}
                />
              )}
            </group>
          );
        })}

        {/* Normal bell-curve arch, brass population-mean plumb line, and environmental shift caliper */}
        {kind === "continuous" && bellCurveGeo !== null ? (
          <group>
            <mesh castShadow geometry={bellCurveGeo}>
              <meshPhysicalMaterial
                clearcoat={0.8}
                color={GENETICS_COLORS.spindleFiber}
                emissive={GENETICS_COLORS.bellCurveBlue}
                emissiveIntensity={0.45}
                roughness={0.2}
              />
            </mesh>
            {/* Turned brass mean guide rod + glowing finial */}
            <mesh castShadow position={[0, 0.72, 0.24]}>
              <cylinderGeometry args={[0.011, 0.011, 1.24, 14]} />
              <MetalMaterial
                color={GENETICS_COLORS.meanAmber}
                roughness={0.24}
              />
            </mesh>
            <mesh castShadow position={[0, 1.35, 0.24]}>
              <sphereGeometry args={[0.032, 16, 14]} />
              <meshPhysicalMaterial
                clearcoat={0.85}
                color={GENETICS_COLORS.meanAmber}
                emissive={GENETICS_COLORS.meanAmber}
                emissiveIntensity={0.35}
                roughness={0.2}
              />
            </mesh>
            {/* Environmental range horizontal caliper gauge with end stops */}
            <group position={[0.45, 0.16, 0.3]}>
              <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.013, 0.013, 0.74, 14]} />
                <meshPhysicalMaterial
                  clearcoat={0.72}
                  color={GENETICS_COLORS.envShiftTeal}
                  emissive={GENETICS_COLORS.envShiftTeal}
                  emissiveIntensity={0.32}
                  roughness={0.24}
                />
              </mesh>
              {Arr.map([-0.37, 0.37] as const, (endX) => (
                <mesh castShadow key={endX} position={[endX, 0, 0]}>
                  <cylinderGeometry args={[0.016, 0.016, 0.075, 14]} />
                  <MetalMaterial
                    color={GENETICS_COLORS.brassPolished}
                    roughness={0.26}
                  />
                </mesh>
              ))}
            </group>
          </group>
        ) : null}
      </group>

      {/* Non-overlapping adaptive-ink labels */}
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        position={[-0.78, 1.24, 0]}
      >
        <span>
          {kind === "continuous" ? parts.bellCurve : parts.discreteBars}
        </span>
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        position={[0, 1.4, 0.24]}
      >
        <span>{parts.meanLine}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorY="top"
        color={ink}
        fontSize="compact"
        position={[0.56, 0.08, 0.42]}
      >
        <span>{parts.environment}</span>
      </ThreeLabel>
    </group>
  );
}
