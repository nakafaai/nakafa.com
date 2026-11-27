import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import {
  AdditiveBlending,
  CatmullRomCurve3,
  DoubleSide,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

/** Authentic Teltron D555 electron diffraction vacuum bulb lathe profile along Y (rotated to X). */
const TELTRON_PROFILE = Arr.map(
  [
    [0.001, -1.16],
    [0.16, -1.16],
    [0.18, -1.12],
    [0.18, -0.24],
    [0.24, -0.06],
    [0.4, 0.22],
    [0.52, 0.62],
    [0.54, 0.94],
    [0.5, 1.1],
    [0.36, 1.18],
    [0.001, 1.22],
  ] as const,
  ([r, y]) => new Vector2(r, y)
);

/** Continuous 3D de Broglie sinusoidal matter-wave ribbon responding to diffractionRadius. */
function createMatterWaveGeometry(diffractionRadius: number): TubeGeometry {
  const waveCycles =
    3.2 + (1 - Math.min(1, Math.max(0.15, diffractionRadius))) * 5.2;
  const pts = Arr.makeBy(80, (index) => {
    const u = index / 79;
    const x = -0.92 + u * 1.15;
    const envelope = Math.sin(u * Math.PI);
    const y =
      Math.sin(u * Math.PI * 2 * waveCycles) * 0.068 * (0.35 + 0.65 * envelope);
    return new Vector3(x, y, 0);
  });
  return new TubeGeometry(new CatmullRomCurve3(pts), 96, 0.014, 10, false);
}

function DeBroglieCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.52, 2.05, 5.1] : [0.35, 1.42, 3.45]}
      cameraTarget={[0.04, 0.64, 0]}
      fov={36}
      maxDistance={6.8}
      minDistance={1.5}
    />
  );
}

export function DeBroglieScene({
  diffractionRadius,
  parts,
}: {
  readonly diffractionRadius: number;
  readonly parts: Readonly<
    Record<
      | "diffractionRings"
      | "electronGun"
      | "graphiteTarget"
      | "matterWave"
      | "screen",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const waveGroupRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  const waveGeom = useMemo(
    () => createMatterWaveGeometry(diffractionRadius),
    [diffractionRadius]
  );
  useEffect(() => () => waveGeom.dispose(), [waveGeom]);

  useVisualStop(() => {
    phaseRef.current = 0;
    if (waveGroupRef.current !== null) {
      waveGroupRef.current.rotation.x = 0;
    }
  });

  useFrame((_, delta) => {
    if (!playing || waveGroupRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 4.5;
    waveGroupRef.current.rotation.x = phaseRef.current;
  });

  const ringInner = 0.12 + diffractionRadius * 0.18;
  const ringOuter = ringInner + 0.11 + diffractionRadius * 0.12;

  return (
    <group>
      <SimulationTicker running={playing} />
      <DeBroglieCamera />

      {/* Satin epoxy optical workbench */}
      <mesh position={[0, -0.04, 0]} receiveShadow>
        <boxGeometry args={[3.2, 0.08, 1.8]} />
        <meshStandardMaterial
          color={QUANTUM_COLORS.benchEpoxy}
          roughness={0.62}
        />
      </mesh>

      {/* Cast-iron laboratory retort stand, rod, and brass neck clamp */}
      <group position={[-0.64, 0, 0]}>
        <mesh castShadow position={[0, 0.035, 0]} receiveShadow>
          <boxGeometry args={[0.78, 0.07, 0.54]} />
          <MetalMaterial color={QUANTUM_COLORS.furnaceSteel} roughness={0.55} />
        </mesh>
        <mesh castShadow position={[0, 0.42, -0.18]}>
          <cylinderGeometry args={[0.022, 0.022, 0.78, 16]} />
          <MetalMaterial color={QUANTUM_COLORS.anodeSteel} roughness={0.28} />
        </mesh>
        <mesh
          castShadow
          position={[0, 0.68, -0.09]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.02, 0.02, 0.18, 14]} />
          <MetalMaterial color={QUANTUM_COLORS.brass} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.68, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.195, 0.018, 12, 32]} />
          <MetalMaterial color={QUANTUM_COLORS.brass} roughness={0.3} />
        </mesh>
      </group>

      {/* Evacuated flared Teltron borosilicate glass bulb */}
      <group position={[0.05, 0.68, 0]}>
        <mesh castShadow renderOrder={2} rotation={[0, 0, -Math.PI / 2]}>
          <latheGeometry args={[TELTRON_PROFILE, 48]} />
          <GlassMaterial color={QUANTUM_COLORS.glassTube} opacity={0.22} />
        </mesh>

        {/* Internal electron gun: socket base, glowing cathode heater, Wehnelt & anode */}
        <mesh
          castShadow
          position={[-1.16, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.16, 0.16, 0.16, 24]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.rubberRing}
            roughness={0.58}
          />
        </mesh>
        <mesh position={[-1.02, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.055, 0.075, 0.14, 20]} />
          <MetalMaterial color={QUANTUM_COLORS.anodeSteel} roughness={0.32} />
        </mesh>
        {/* Incandescent tungsten cathode heater filament */}
        <mesh position={[-1.04, 0, 0]}>
          <sphereGeometry args={[0.032, 16, 12]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.heaterCoil}
            emissive={QUANTUM_COLORS.heaterCoil}
            emissiveIntensity={1.6}
          />
        </mesh>
        {/* Anode collimator nozzle */}
        <mesh position={[-0.78, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.068, 0.068, 0.18, 22]} />
          <MetalMaterial color={QUANTUM_COLORS.aluminium} roughness={0.28} />
        </mesh>

        {/* Polycrystalline graphite foil target mounted in precision copper ring */}
        <group position={[-0.22, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <mesh>
            <torusGeometry args={[0.125, 0.016, 12, 32]} />
            <MetalMaterial color={QUANTUM_COLORS.copper} roughness={0.26} />
          </mesh>
          <mesh>
            <circleGeometry args={[0.115, 28]} />
            <meshStandardMaterial
              color={QUANTUM_COLORS.graphite}
              metalness={0.45}
              roughness={0.5}
              side={DoubleSide}
            />
          </mesh>
        </group>

        {/* Continuous 3D de Broglie matter-wave ribbon (wavelength updates immediately!) */}
        <group ref={waveGroupRef}>
          <mesh geometry={waveGeom}>
            <meshStandardMaterial
              color={QUANTUM_COLORS.matterWave}
              emissive={QUANTUM_COLORS.matterWave}
              emissiveIntensity={1.15}
              roughness={0.22}
            />
          </mesh>
        </group>

        {/* Diffracted conical electron beam envelope from graphite to phosphor screen */}
        <mesh position={[0.46, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.03, ringOuter, 1.34, 32, 1, true]} />
          <meshBasicMaterial
            blending={AdditiveBlending}
            color={QUANTUM_COLORS.diffractionRing}
            depthWrite={false}
            opacity={0.14}
            side={DoubleSide}
            transparent
          />
        </mesh>

        {/* Curved emerald zinc-sulfide phosphor screen with Debye-Scherrer diffraction rings */}
        <group position={[1.1, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh>
            <circleGeometry args={[0.48, 40]} />
            <meshStandardMaterial
              color={QUANTUM_COLORS.screenGlow}
              emissive={QUANTUM_COLORS.screenGlow}
              emissiveIntensity={0.45}
              roughness={0.36}
            />
          </mesh>
          {/* Central unscattered electron beam spot */}
          <mesh position={[0, 0, 0.01]}>
            <circleGeometry args={[0.038, 20]} />
            <meshStandardMaterial
              color={QUANTUM_COLORS.diffractionRing}
              emissive={QUANTUM_COLORS.diffractionRing}
              emissiveIntensity={1.8}
            />
          </mesh>
          {/* Inner (10) diffraction ring */}
          <mesh position={[0, 0, 0.012]}>
            <torusGeometry args={[ringInner, 0.016, 12, 48]} />
            <meshStandardMaterial
              color={QUANTUM_COLORS.diffractionRing}
              emissive={QUANTUM_COLORS.diffractionRing}
              emissiveIntensity={1.45}
              roughness={0.2}
            />
          </mesh>
          {/* Outer (11) diffraction ring */}
          <mesh position={[0, 0, 0.012]}>
            <torusGeometry args={[ringOuter, 0.013, 12, 48]} />
            <meshStandardMaterial
              color={QUANTUM_COLORS.diffractionRing}
              emissive={QUANTUM_COLORS.diffractionRing}
              emissiveIntensity={1.0}
              roughness={0.22}
            />
          </mesh>
        </group>
      </group>

      {/* Crisp staggered labels cleanly spaced inside viewport */}
      <ThreeLabel color={ink} fontSize="compact" position={[-1.2, 1.06, 0]}>
        <span>{parts.electronGun}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.48, 0.3, 0.25]}>
        <span>{parts.matterWave}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.08, 1.18, 0]}>
        <span>{parts.graphiteTarget}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.98, 1.32, 0]}>
        <span>{parts.diffractionRings}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[1.02, 0.14, 0.2]}>
        <span>{parts.screen}</span>
      </ThreeLabel>
    </group>
  );
}
