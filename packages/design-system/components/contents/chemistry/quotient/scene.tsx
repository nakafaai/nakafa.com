import { useFrame, useThree } from "@react-three/fiber";
import type { QuotientDirection } from "@repo/design-system/components/contents/chemistry/quotient/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { EQUILIBRIUM_COLORS } from "@repo/design-system/lib/material/equilibrium";
import { Array as Arr, Match } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

function QuotientCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.9, 4.15] : [0, 1.5, 3.25]}
      cameraTarget={[0, 0.56, 0]}
      fov={38}
      maxDistance={6.5}
      minDistance={1.5}
    />
  );
}

export function QuotientBalanceScene({
  direction,
  productLabel,
  productRatio,
  reactantLabel,
  reactantRatio,
  tiltRad,
}: {
  readonly direction: QuotientDirection;
  readonly productLabel: string;
  readonly productRatio: number;
  readonly reactantLabel: string;
  readonly reactantRatio: number;
  readonly tiltRad: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const beamRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  const reactantDots = useMemo(
    () =>
      Arr.makeBy(Math.max(1, Math.round(reactantRatio * 14)), (index) => ({
        id: `reactant-${index}`,
        x: Math.cos(index * 2.3) * 0.24,
        y: 0.2 + (index % 6) * 0.12,
        z: Math.sin(index * 2.3) * 0.24,
      })),
    [reactantRatio]
  );
  const productDots = useMemo(
    () =>
      Arr.makeBy(Math.round(productRatio * 14), (index) => ({
        id: `product-${index}`,
        x: Math.cos(index * 2.1 + 1.1) * 0.26,
        y: 0.24 + (index % 6) * 0.12,
        z: Math.sin(index * 2.1 + 1.1) * 0.26,
      })),
    [productRatio]
  );

  useFrame((_, delta) => {
    const beam = beamRef.current;
    if (beam === null) {
      return;
    }
    const dt = simulationStep(delta);
    if (playing) {
      phaseRef.current += dt * 2.2;
    }
    const wobble = playing ? Math.sin(phaseRef.current) * 0.035 : 0;
    beam.rotation.z +=
      (tiltRad + wobble - beam.rotation.z) * Math.min(1, dt * 8);
  });

  const shiftColor = Match.value(direction).pipe(
    Match.when("equilibrium", () => EQUILIBRIUM_COLORS.balancedGlow),
    Match.when("forward", () => EQUILIBRIUM_COLORS.forwardArrow),
    Match.when("reverse", () => EQUILIBRIUM_COLORS.reverseArrow),
    Match.exhaustive
  );

  return (
    <group>
      <SimulationTicker running={playing} />
      <QuotientCamera />
      {/* Reaction vessel on the left */}
      <group position={[-0.92, 0, 0]}>
        <mesh castShadow position={[0, 0.04, 0]} receiveShadow>
          <cylinderGeometry args={[0.56, 0.6, 0.08, 24]} />
          <meshStandardMaterial
            color={EQUILIBRIUM_COLORS.vesselBase}
            roughness={0.55}
          />
        </mesh>
        <mesh position={[0, 0.56, 0]}>
          <cylinderGeometry args={[0.48, 0.48, 0.96, 28]} />
          <meshPhysicalMaterial
            color={EQUILIBRIUM_COLORS.vesselGlass}
            opacity={0.24}
            roughness={0.14}
            transparent
          />
        </mesh>
        {Arr.map(reactantDots, (dot) => (
          <mesh castShadow key={dot.id} position={[dot.x, dot.y, dot.z]}>
            <sphereGeometry args={[0.048, 12, 10]} />
            <meshStandardMaterial
              color={EQUILIBRIUM_COLORS.reactant}
              roughness={0.4}
            />
          </mesh>
        ))}
        {Arr.map(productDots, (dot) => (
          <mesh castShadow key={dot.id} position={[dot.x, dot.y, dot.z]}>
            <octahedronGeometry args={[0.052, 0]} />
            <meshStandardMaterial
              color={EQUILIBRIUM_COLORS.product}
              roughness={0.4}
            />
          </mesh>
        ))}
        <ThreeLabel
          color={EQUILIBRIUM_COLORS.labelInk}
          fontSize="compact"
          position={[0, 1.16, 0]}
        >
          <span>
            {reactantLabel} / {productLabel}
          </span>
        </ThreeLabel>
      </group>

      {/* Analytical Qc vs Kc balance beam on the right */}
      <group position={[0.65, 0, 0]}>
        <mesh castShadow position={[0, 0.04, 0]} receiveShadow>
          <boxGeometry args={[0.8, 0.08, 0.5]} />
          <meshStandardMaterial
            color={EQUILIBRIUM_COLORS.vesselBase}
            roughness={0.55}
          />
        </mesh>
        <mesh castShadow position={[0, 0.46, 0]}>
          <cylinderGeometry args={[0.05, 0.07, 0.8, 16]} />
          <meshStandardMaterial
            color={EQUILIBRIUM_COLORS.beamBrass}
            metalness={0.55}
            roughness={0.32}
          />
        </mesh>
        <group position={[0, 0.86, 0]} ref={beamRef}>
          <mesh castShadow>
            <boxGeometry args={[1.28, 0.055, 0.07]} />
            <meshStandardMaterial
              color={EQUILIBRIUM_COLORS.beamBrass}
              metalness={0.55}
              roughness={0.32}
            />
          </mesh>
          <mesh castShadow position={[-0.54, -0.22, 0]}>
            <cylinderGeometry args={[0.22, 0.18, 0.04, 20]} />
            <meshStandardMaterial
              color={EQUILIBRIUM_COLORS.qcMarker}
              roughness={0.42}
            />
          </mesh>
          <mesh castShadow position={[0.54, -0.22, 0]}>
            <cylinderGeometry args={[0.22, 0.18, 0.04, 20]} />
            <meshStandardMaterial
              color={EQUILIBRIUM_COLORS.kcMarker}
              roughness={0.42}
            />
          </mesh>
          <ThreeLabel
            color={EQUILIBRIUM_COLORS.labelInk}
            fontSize="compact"
            position={[-0.54, 0.18, 0]}
          >
            <span className="font-medium">Qc</span>
          </ThreeLabel>
          <ThreeLabel
            color={EQUILIBRIUM_COLORS.labelInk}
            fontSize="compact"
            position={[0.54, 0.18, 0]}
          >
            <span className="font-medium">Kc</span>
          </ThreeLabel>
        </group>
        <mesh position={[0, 0.12, 0.28]}>
          <sphereGeometry args={[0.055, 14, 10]} />
          <meshStandardMaterial color={shiftColor} roughness={0.38} />
        </mesh>
      </group>
    </group>
  );
}
