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
import { CanvasTexture, Color, SRGBColorSpace } from "three";

const COOL = new Color(QUANTUM_COLORS.gasCool);
const WARM = new Color(QUANTUM_COLORS.gasWarm);
const HOT = new Color(QUANTUM_COLORS.gasHot);

const TIE_RODS = [
  [0.54, 0.24],
  [-0.54, 0.24],
  [0.54, -0.24],
  [-0.54, -0.24],
] as const;

function createPressureDialTexture(): CanvasTexture | null {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.fillStyle = QUANTUM_COLORS.dialFace;
  ctx.beginPath();
  ctx.arc(128, 128, 124, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = QUANTUM_COLORS.dialInk;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(128, 128, 118, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i <= 10; i += 1) {
    const angle = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    const x1 = 128 + Math.cos(angle) * 92;
    const y1 = 128 + Math.sin(angle) * 92;
    const x2 = 128 + Math.cos(angle) * 112;
    const y2 = 128 + Math.sin(angle) * 112;
    ctx.strokeStyle =
      i >= 8 ? QUANTUM_COLORS.dialNeedle : QUANTUM_COLORS.dialInk;
    ctx.lineWidth = i % 2 === 0 ? 5 : 2.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.fillStyle = QUANTUM_COLORS.dialInk;
  ctx.font = "700 24px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("kPa", 128, 194);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function GasLawCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [1.75, 1.55, 3.65] : [1.45, 1.35, 3.05]}
      cameraTarget={[0.08, 0.66, 0]}
      fov={36}
      maxDistance={6.4}
      minDistance={1.5}
    />
  );
}

export function GasLawScene({
  effectiveVolumeL,
  parts,
  pressureKpa = 101.3,
  temperatureK,
}: {
  readonly effectiveVolumeL: number;
  readonly parts: Readonly<
    Record<"cylinder" | "gauge" | "heater" | "molecules" | "piston", string>
  >;
  readonly pressureKpa?: number;
  readonly temperatureK: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const particlesRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  const dialTex = useMemo(createPressureDialTexture, []);
  useEffect(() => () => dialTex?.dispose(), [dialTex]);

  const pistonY = 0.44 + Math.min(0.74, (effectiveVolumeL / 22) * 0.74);
  const seeds = useMemo(
    () =>
      Arr.makeBy(20, (index) => ({
        angle: index * 1.9,
        id: `m-${index}`,
        r: 0.12 + (index % 4) * 0.095,
        speed: 1.3 + (index % 5) * 0.4,
      })),
    []
  );

  // Smooth continuous thermal color & hotplate glow across 200..600 K
  const heatNorm = Math.min(1, Math.max(0, (temperatureK - 200) / 400));
  const gasColor = useMemo(() => {
    const out = new Color();
    if (heatNorm < 0.5) {
      out.copy(COOL).lerp(WARM, heatNorm * 2);
    } else {
      out.copy(WARM).lerp(HOT, (heatNorm - 0.5) * 2);
    }
    return `#${out.getHexString()}`;
  }, [heatNorm]);

  // Bourdon dial needle angle responds continuously to pressureKpa (40..320 kPa)
  const pressureNorm = Math.min(1, Math.max(0, (pressureKpa - 40) / 280));
  const needleAngle = Math.PI * 0.75 - pressureNorm * Math.PI * 1.5;

  useVisualStop(() => {
    phaseRef.current = 0;
  });

  useFrame((_, delta) => {
    if (!playing || particlesRef.current === null) {
      return;
    }
    const thermalSpeed = Math.sqrt(Math.max(100, temperatureK) / 300);
    phaseRef.current += simulationStep(delta) * 2.5 * thermalSpeed;
    for (let i = 0; i < particlesRef.current.children.length; i += 1) {
      const child = particlesRef.current.children[i];
      const seed = seeds[i];
      if (child !== undefined && seed !== undefined) {
        const t = phaseRef.current * seed.speed + seed.angle;
        child.position.set(
          Math.cos(t) * seed.r,
          0.24 + ((Math.sin(t * 1.3) + 1) / 2) * (pistonY - 0.34),
          Math.sin(t) * seed.r
        );
      }
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <GasLawCamera />

      {/* Satin epoxy benchtop */}
      <mesh position={[0, -0.03, 0]} receiveShadow>
        <boxGeometry args={[2.8, 0.06, 1.8]} />
        <meshStandardMaterial
          color={QUANTUM_COLORS.benchEpoxy}
          roughness={0.62}
        />
      </mesh>

      {/* Ceramic laboratory hotplate base with continuous thermal coil glow */}
      <group position={[0, 0, 0]}>
        <mesh castShadow position={[0, 0.075, 0]} receiveShadow>
          <cylinderGeometry args={[0.68, 0.74, 0.15, 48]} />
          <MetalMaterial color={QUANTUM_COLORS.furnaceSteel} roughness={0.42} />
        </mesh>
        <mesh position={[0, 0.155, 0]} receiveShadow>
          <cylinderGeometry args={[0.62, 0.64, 0.025, 48]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.hotplateDeck}
            roughness={0.34}
          />
        </mesh>
        {/* Glowing hotplate spiral ring */}
        <mesh position={[0, 0.17, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.36, 0.022, 12, 48]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.heaterCoil}
            emissive={QUANTUM_COLORS.heaterCoil}
            emissiveIntensity={0.08 + heatNorm * 1.85}
            roughness={0.3}
          />
        </mesh>
        {/* Front temperature control knob */}
        <mesh
          castShadow
          position={[0.42, 0.075, 0.56]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.045, 0.05, 0.06, 20]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.rubberRing}
            roughness={0.55}
          />
        </mesh>
      </group>

      {/* Lower & upper machined aluminum cylinder flanges + 4 stainless tie-rods */}
      <mesh castShadow position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.58, 0.58, 0.05, 48]} />
        <MetalMaterial color={QUANTUM_COLORS.aluminium} roughness={0.3} />
      </mesh>
      <mesh castShadow position={[0, 1.32, 0]}>
        <cylinderGeometry args={[0.58, 0.58, 0.05, 48]} />
        <MetalMaterial color={QUANTUM_COLORS.aluminium} roughness={0.3} />
      </mesh>
      {Arr.map(TIE_RODS, ([rx, rz]) => (
        <mesh castShadow key={`${rx}-${rz}`} position={[rx, 0.76, rz]}>
          <cylinderGeometry args={[0.016, 0.016, 1.14, 12]} />
          <MetalMaterial color={QUANTUM_COLORS.anodeSteel} roughness={0.28} />
        </mesh>
      ))}

      {/* Heavy-walled borosilicate glass cylinder */}
      <mesh position={[0, 0.76, 0]} renderOrder={2}>
        <cylinderGeometry args={[0.5, 0.5, 1.1, 48, 1, true]} />
        <GlassMaterial color={QUANTUM_COLORS.glassTube} opacity={0.24} />
      </mesh>
      <mesh position={[0, 1.29, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.5, 0.012, 10, 48]} />
        <GlassMaterial color={QUANTUM_COLORS.glassRim} opacity={0.5} />
      </mesh>

      {/* Machined brushed-steel piston with dual O-rings and T-handle */}
      <group position={[0, pistonY, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.485, 0.485, 0.1, 48]} />
          <MetalMaterial color={QUANTUM_COLORS.pistonMetal} roughness={0.26} />
        </mesh>
        <mesh position={[0, 0.025, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.488, 0.014, 10, 48]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.rubberRing}
            roughness={0.78}
          />
        </mesh>
        <mesh position={[0, -0.025, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.488, 0.014, 10, 48]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.rubberRing}
            roughness={0.78}
          />
        </mesh>
        <mesh castShadow position={[0, 0.34, 0]}>
          <cylinderGeometry args={[0.044, 0.044, 0.64, 20]} />
          <MetalMaterial color={QUANTUM_COLORS.anodeSteel} roughness={0.22} />
        </mesh>
        <mesh castShadow position={[0, 0.66, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.036, 0.036, 0.36, 18]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.rubberRing}
            roughness={0.62}
          />
        </mesh>
      </group>

      {/* Brass Bourdon dial pressure gauge with live rotating needle */}
      <group position={[0.76, 0.56, 0.08]}>
        {/* Brass manifold stem */}
        <mesh position={[-0.18, -0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.028, 0.028, 0.24, 16]} />
          <MetalMaterial color={QUANTUM_COLORS.brass} roughness={0.3} />
        </mesh>
        <mesh position={[-0.02, -0.08, 0]}>
          <cylinderGeometry args={[0.028, 0.028, 0.14, 16]} />
          <MetalMaterial color={QUANTUM_COLORS.brass} roughness={0.3} />
        </mesh>
        {/* Machined brass bezel */}
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.08, 36]} />
          <MetalMaterial color={QUANTUM_COLORS.brass} roughness={0.28} />
        </mesh>
        {/* Printed kPa dial face */}
        <mesh position={[0, 0, 0.042]}>
          <circleGeometry args={[0.175, 36]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.dialFace}
            map={dialTex}
            roughness={0.4}
          />
        </mesh>
        {/* Live rotating pressure pointer needle */}
        <group position={[0, 0, 0.048]} rotation={[0, 0, needleAngle]}>
          <mesh position={[0.055, 0, 0]}>
            <boxGeometry args={[0.12, 0.014, 0.008]} />
            <meshStandardMaterial
              color={QUANTUM_COLORS.dialNeedle}
              roughness={0.3}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.012, 16]} />
            <MetalMaterial color={QUANTUM_COLORS.dialInk} roughness={0.35} />
          </mesh>
        </group>
      </group>

      {/* Thermal gas molecules */}
      <group ref={particlesRef}>
        {Arr.map(seeds, (seed) => (
          <mesh
            key={seed.id}
            position={[
              Math.cos(seed.angle) * seed.r,
              0.26 + ((seed.angle * 0.13) % Math.max(0.14, pistonY - 0.34)),
              Math.sin(seed.angle) * seed.r,
            ]}
          >
            <sphereGeometry args={[0.038, 16, 12]} />
            <meshPhysicalMaterial
              clearcoat={0.7}
              color={gasColor}
              emissive={gasColor}
              emissiveIntensity={0.28 + heatNorm * 0.42}
              roughness={0.22}
            />
          </mesh>
        ))}
      </group>

      {/* Crisp compact non-overlapping labels well inside viewport */}
      <ThreeLabel
        color={ink}
        fontSize="compact"
        position={[0, pistonY + 0.78, 0]}
      >
        <span>{parts.piston}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.84, 0.84, 0]}>
        <span>{parts.cylinder}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.78, 0.88, 0.1]}>
        <span>{parts.gauge}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.96, 0.14, 0.25]}>
        <span>{parts.heater}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.04, 0.56, 0.56]}>
        <span>{parts.molecules}</span>
      </ThreeLabel>
    </group>
  );
}
