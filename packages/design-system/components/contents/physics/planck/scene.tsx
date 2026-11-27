import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type { RadiationModel } from "@repo/design-system/components/contents/physics/planck/model";
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
  CanvasTexture,
  Color,
  DoubleSide,
  SRGBColorSpace,
} from "three";

function createPyrometerDialTexture(): CanvasTexture | null {
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
    const x1 = 128 + Math.cos(angle) * 90;
    const y1 = 128 + Math.sin(angle) * 90;
    const x2 = 128 + Math.cos(angle) * 112;
    const y2 = 128 + Math.sin(angle) * 112;
    ctx.strokeStyle =
      i >= 7 ? QUANTUM_COLORS.dialNeedle : QUANTUM_COLORS.dialInk;
    ctx.lineWidth = i % 2 === 0 ? 5 : 2.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.fillStyle = QUANTUM_COLORS.dialInk;
  ctx.font = "700 28px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("K", 128, 196);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const COOL_GLOW = new Color(QUANTUM_COLORS.planckCool);
const MID_GLOW = new Color(QUANTUM_COLORS.planckMid);
const WHITE_GLOW = new Color(QUANTUM_COLORS.planckWhite);
const HOT_GLOW = new Color(QUANTUM_COLORS.planckHot);

const COOLING_FINS = Arr.makeBy(7, (i) => -0.42 + i * 0.14);
const PHOTON_PACKETS = Arr.makeBy(6, (i) => i);

/** Continuous physically-inspired Planckian chromaticity across 1500..7000 K. */
function planckGlowHex(tempK: number): string {
  const norm = Math.min(1, Math.max(0, (tempK - 1500) / 5500));
  const out = new Color();
  if (norm < 0.35) {
    out.copy(COOL_GLOW).lerp(MID_GLOW, norm / 0.35);
  } else if (norm < 0.72) {
    out.copy(MID_GLOW).lerp(WHITE_GLOW, (norm - 0.35) / 0.37);
  } else {
    out.copy(WHITE_GLOW).lerp(HOT_GLOW, (norm - 0.72) / 0.28);
  }
  return `#${out.getHexString()}`;
}

function PlanckCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [1.75, 1.55, 3.35] : [1.45, 1.32, 2.75]}
      cameraTarget={[0.05, 0.56, 0.12]}
      fov={36}
      maxDistance={6.2}
      minDistance={1.4}
    />
  );
}

export function PlanckCavityScene({
  model = "planck",
  parts,
  temperatureK,
}: {
  readonly model?: RadiationModel;
  readonly parts: Readonly<
    Record<
      | "cavity"
      | "classicalCurve"
      | "peakMarker"
      | "planckCurve"
      | "visibleBand",
      string
    >
  >;
  readonly temperatureK: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const beamRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const dialTex = useMemo(createPyrometerDialTexture, []);
  useEffect(() => () => dialTex?.dispose(), [dialTex]);

  const tempNorm = Math.min(1, Math.max(0, (temperatureK - 1500) / 5500));
  const glow = useMemo(() => planckGlowHex(temperatureK), [temperatureK]);
  const intensity = 0.65 + tempNorm * 1.9;
  const pyrometerAngle = Math.PI * 0.75 - tempNorm * Math.PI * 1.5;

  useVisualStop(() => {
    phaseRef.current = 0;
    if (beamRef.current !== null) {
      Arr.forEach(beamRef.current.children, (child, idx) => {
        child.position.z = 0.56 + (idx / PHOTON_PACKETS.length) * 0.68;
        child.scale.setScalar(1);
      });
    }
  });

  useFrame((_, delta) => {
    if (!playing || beamRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * (1.8 + tempNorm * 2.2);
    Arr.forEach(beamRef.current.children, (child, idx) => {
      const t = (phaseRef.current * 0.45 + idx / PHOTON_PACKETS.length) % 1;
      child.position.z = 0.52 + t * 0.72;
      const scale = 0.75 + Math.sin(t * Math.PI) * 0.45;
      child.scale.setScalar(scale);
    });
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <PlanckCamera />

      {/* Satin epoxy optical workbench */}
      <mesh position={[0, -0.04, 0.1]} receiveShadow>
        <boxGeometry args={[2.9, 0.08, 2.2]} />
        <meshStandardMaterial
          color={QUANTUM_COLORS.benchEpoxy}
          roughness={0.62}
        />
      </mesh>

      {/* Refractory Calibration Blackbody Furnace (cylindrical finned kiln) */}
      <group position={[0, 0.54, -0.18]}>
        {/* Insulated cast-steel mounting cradle & ceramic feet */}
        <mesh castShadow position={[0, -0.45, 0]} receiveShadow>
          <boxGeometry args={[0.92, 0.14, 0.94]} />
          <MetalMaterial color={QUANTUM_COLORS.furnaceSteel} roughness={0.5} />
        </mesh>
        {/* Main cylindrical steel furnace barrel */}
        <mesh castShadow receiveShadow rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.46, 0.46, 1.04, 40]} />
          <MetalMaterial color={QUANTUM_COLORS.furnaceSteel} roughness={0.42} />
        </mesh>
        {/* Radial machined cooling fins */}
        {Arr.map(COOLING_FINS, (fz) => (
          <mesh
            castShadow
            key={fz}
            position={[0, 0, fz]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.53, 0.53, 0.032, 40]} />
            <MetalMaterial color={QUANTUM_COLORS.furnaceFin} roughness={0.36} />
          </mesh>
        ))}
        {/* Front refractory alumina firebrick faceplate collar */}
        <mesh position={[0, 0, 0.53]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.38, 0.42, 0.06, 36]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.ceramic}
            roughness={0.78}
          />
        </mesh>
        <mesh position={[0, 0, 0.56]}>
          <torusGeometry args={[0.21, 0.032, 14, 36]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.firebrick}
            roughness={0.85}
          />
        </mesh>
        {/* Deep glowing isothermal hohlraum cavity */}
        <mesh position={[0, 0, 0.54]}>
          <circleGeometry args={[0.195, 36]} />
          <meshStandardMaterial
            color={glow}
            emissive={glow}
            emissiveIntensity={intensity}
            roughness={0.18}
          />
        </mesh>
        <pointLight
          color={glow}
          distance={3.2}
          intensity={1.2 + tempNorm * 2.5}
          position={[0, 0, 0.72]}
        />

        {/* Side thermocouple pyrometer dial whose red needle moves on every 100 K step */}
        <group position={[0.56, 0.14, 0.22]} rotation={[0, Math.PI / 4, 0]}>
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.06, 32]} />
            <MetalMaterial color={QUANTUM_COLORS.brass} roughness={0.28} />
          </mesh>
          <mesh position={[0, 0, 0.032]}>
            <circleGeometry args={[0.14, 32]} />
            <meshStandardMaterial
              color={QUANTUM_COLORS.dialFace}
              map={dialTex}
              roughness={0.4}
            />
          </mesh>
          <group position={[0, 0, 0.038]} rotation={[0, 0, pyrometerAngle]}>
            <mesh position={[0.045, 0, 0]}>
              <boxGeometry args={[0.095, 0.012, 0.008]} />
              <meshStandardMaterial
                color={QUANTUM_COLORS.dialNeedle}
                roughness={0.3}
              />
            </mesh>
          </group>
        </group>

        {/* Emerging cavity radiation beam: quantized photon packets vs classical UV surge */}
        {model === "planck" ? (
          <group ref={beamRef}>
            {Arr.map(PHOTON_PACKETS, (idx) => (
              <mesh
                key={idx}
                position={[0, 0, 0.56 + (idx / PHOTON_PACKETS.length) * 0.68]}
              >
                <sphereGeometry args={[0.044 + tempNorm * 0.018, 18, 14]} />
                <meshStandardMaterial
                  color={glow}
                  emissive={glow}
                  emissiveIntensity={intensity * 1.1}
                  roughness={0.16}
                />
              </mesh>
            ))}
          </group>
        ) : (
          <mesh position={[0, 0, 0.9]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.075, 0.15, 0.72, 24, 1, true]} />
            <meshBasicMaterial
              blending={AdditiveBlending}
              color={QUANTUM_COLORS.uvBeam}
              depthWrite={false}
              opacity={0.42 + tempNorm * 0.3}
              side={DoubleSide}
              transparent
            />
          </mesh>
        )}

        {/* Optical glass dispersion prism on brass bench post in front of aperture */}
        <group position={[0, -0.02, 1.18]}>
          <mesh castShadow position={[0, -0.34, 0]}>
            <cylinderGeometry args={[0.024, 0.024, 0.34, 16]} />
            <MetalMaterial color={QUANTUM_COLORS.brass} roughness={0.28} />
          </mesh>
          <mesh position={[0, -0.5, 0]}>
            <cylinderGeometry args={[0.12, 0.13, 0.04, 24]} />
            <MetalMaterial
              color={QUANTUM_COLORS.furnaceSteel}
              roughness={0.45}
            />
          </mesh>
          <mesh castShadow position={[0, -0.02, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.3, 3]} />
            <GlassMaterial color={QUANTUM_COLORS.prismGlass} opacity={0.34} />
          </mesh>
        </group>
      </group>

      {/* Crisp compact non-overlapping labels */}
      <ThreeLabel color={ink} fontSize="compact" position={[0, 1.24, -0.18]}>
        <span>{parts.cavity}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.78, 0.92, 0.18]}>
        <span>{parts.peakMarker}</span>
      </ThreeLabel>
    </group>
  );
}
