import type { Specimen } from "@repo/design-system/components/contents/biology/drawing/scale";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  CanvasTexture,
  CatmullRomCurve3,
  SRGBColorSpace,
  Vector3,
} from "three";

const OBJECTIVES = [
  { color: BIOLOGY_COLORS.objectiveRed, len: 0.048, yaw: 0 },
  { color: BIOLOGY_COLORS.objectiveYellow, len: 0.064, yaw: (Math.PI * 2) / 3 },
  { color: BIOLOGY_COLORS.objectiveBlue, len: 0.082, yaw: (Math.PI * 4) / 3 },
] as const;

/** Procedural cotton-rag scientific drawing paper grain texture. */
function createPaperTexture(): CanvasTexture | null {
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
  ctx.fillStyle = LABORATORY_COLORS.paper;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = BOTANY_COLORS.labelBorder;
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, 236, 236);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Realistic brass and cream-enamel compound light microscope with glass objectives, stage clips, and stained glass slide. */
export function CompoundMicroscope({
  position,
  specimen,
}: {
  readonly position: readonly [number, number, number];
  readonly specimen: Specimen;
}) {
  const armCurve = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0, 0.04, -0.1),
        new Vector3(0, 0.16, -0.115),
        new Vector3(0, 0.3, -0.095),
        new Vector3(0, 0.38, -0.03),
        new Vector3(0, 0.4, 0.015),
      ]),
    []
  );

  return (
    <group position={position} rotation={[0, 0.48, 0]}>
      {/* Heavy horseshoe enamel base */}
      <mesh castShadow position={[0, 0.022, -0.01]} receiveShadow>
        <boxGeometry args={[0.2, 0.044, 0.28]} />
        <meshPhysicalMaterial
          clearcoat={0.65}
          color={BIOLOGY_COLORS.microscopeEnamel}
          roughness={0.32}
        />
      </mesh>
      {/* Glowing substage illuminator lens */}
      <mesh position={[0, 0.048, 0.025]}>
        <cylinderGeometry args={[0.028, 0.032, 0.01, 28]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.lampFilament}
          emissive={BOTANY_COLORS.lampFilament}
          emissiveIntensity={1.6}
          roughness={0.18}
        />
      </mesh>
      {/* Curved enamel arm */}
      <mesh castShadow>
        <tubeGeometry args={[armCurve, 32, 0.024, 14, false]} />
        <meshPhysicalMaterial
          clearcoat={0.65}
          color={BIOLOGY_COLORS.microscopeEnamel}
          roughness={0.32}
        />
      </mesh>
      {/* Coaxial brass coarse/fine focus knobs */}
      {Arr.map([-1, 1] as const, (side) => (
        <group
          key={side}
          position={[side * 0.034, 0.13, -0.1]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <mesh castShadow>
            <cylinderGeometry args={[0.032, 0.032, 0.018, 28]} />
            <MetalMaterial color={BOTANY_COLORS.brassGold} roughness={0.3} />
          </mesh>
          <mesh castShadow position={[0, side * 0.016, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.014, 24]} />
            <meshStandardMaterial
              color={BIOLOGY_COLORS.microscopeBlack}
              roughness={0.55}
            />
          </mesh>
        </group>
      ))}
      {/* Black mechanical stage + chrome stage clips + stained glass slide */}
      <group position={[0, 0.185, 0.02]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.17, 0.014, 0.16]} />
          <meshStandardMaterial
            color={BIOLOGY_COLORS.microscopeBlack}
            roughness={0.48}
          />
        </mesh>
        {/* Translucent borosilicate glass microscope slide */}
        <mesh position={[0, 0.01, 0.005]}>
          <boxGeometry args={[0.12, 0.004, 0.044]} />
          <GlassMaterial color={BENCH_COLORS.glass} opacity={0.46} />
        </mesh>
        {/* Stained specimen smear under glass coverslip */}
        <mesh position={[0, 0.0125, 0.005]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.014, 24]} />
          <meshStandardMaterial
            color={
              specimen === "onion"
                ? BIOLOGY_COLORS.onionWall
                : BIOLOGY_COLORS.methyleneBlue
            }
            opacity={0.75}
            roughness={0.38}
            transparent
          />
        </mesh>
        {Arr.map([-1, 1] as const, (side) => (
          <mesh
            castShadow
            key={`clip-${side}`}
            position={[side * 0.046, 0.012, -0.016]}
            rotation={[0, side * 0.2, 0]}
          >
            <boxGeometry args={[0.01, 0.003, 0.062]} />
            <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
          </mesh>
        ))}
      </group>
      {/* Revolving chrome nosepiece & ISO-coded glass objective lenses */}
      <group position={[0, 0.34, 0.016]} rotation={[0.35, 0, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.044, 0.038, 0.02, 32]} />
          <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
        </mesh>
        {Arr.map(OBJECTIVES, (obj) => (
          <group key={obj.color} rotation={[0, obj.yaw, 0]}>
            <group position={[0, 0, 0.024]} rotation={[-0.35, 0, 0]}>
              <mesh castShadow position={[0, -obj.len / 2 - 0.008, 0]}>
                <cylinderGeometry args={[0.012, 0.009, obj.len, 24]} />
                <MetalMaterial color={CAR_COLORS.chrome} roughness={0.2} />
              </mesh>
              <mesh position={[0, -obj.len * 0.38 - 0.008, 0]}>
                <cylinderGeometry args={[0.0126, 0.0126, 0.006, 24]} />
                <meshStandardMaterial color={obj.color} roughness={0.36} />
              </mesh>
              <mesh position={[0, -obj.len - 0.008, 0]}>
                <sphereGeometry args={[0.007, 12, 10]} />
                <GlassMaterial color={BIOLOGY_COLORS.lensBlue} opacity={0.72} />
              </mesh>
            </group>
          </group>
        ))}
      </group>
      {/* Inclined brass & black eyepiece tube */}
      <group position={[0, 0.42, 0.016]} rotation={[0.58, 0, 0]}>
        <mesh castShadow position={[0, 0.055, 0]}>
          <cylinderGeometry args={[0.019, 0.022, 0.11, 28]} />
          <meshStandardMaterial
            color={BIOLOGY_COLORS.microscopeBlack}
            roughness={0.44}
          />
        </mesh>
        <mesh position={[0, 0.112, 0]}>
          <cylinderGeometry args={[0.022, 0.022, 0.01, 28]} />
          <MetalMaterial color={BOTANY_COLORS.brassGold} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.118, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.015, 24]} />
          <GlassMaterial color={BIOLOGY_COLORS.lensBlue} opacity={0.74} />
        </mesh>
      </group>
    </group>
  );
}

/** Illuminated brass-rimmed optical eyepiece field-of-view showing a realistic translucent stained cell. */
export function IlluminatedEyepieceInset({
  position,
  specimen,
}: {
  readonly position: readonly [number, number, number];
  readonly specimen: Specimen;
}) {
  return (
    <group position={position}>
      {/* Brushed brass optical housing bezel */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.255, 0.265, 0.022, 44]} />
        <MetalMaterial color={BOTANY_COLORS.brassGold} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.012, 0]}>
        <cylinderGeometry args={[0.232, 0.232, 0.008, 44]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.paper}
          emissive={LABORATORY_COLORS.spot}
          emissiveIntensity={0.42}
          roughness={0.25}
        />
      </mesh>
      {specimen === "onion" ? (
        <group position={[0, 0.02, 0]}>
          {/* Rigid iodine-stained cellulose wall frame */}
          <mesh>
            <boxGeometry args={[0.31, 0.008, 0.18]} />
            <meshPhysicalMaterial
              clearcoat={0.4}
              color={BIOLOGY_COLORS.onionWall}
              opacity={0.85}
              roughness={0.42}
              transparent
            />
          </mesh>
          {/* Translucent golden cytoplasm */}
          <mesh position={[0, 0.003, 0]}>
            <boxGeometry args={[0.278, 0.008, 0.148]} />
            <meshPhysicalMaterial
              clearcoat={0.5}
              color={BIOLOGY_COLORS.onionCell}
              opacity={0.78}
              roughness={0.3}
              transparent
            />
          </mesh>
          {/* Large central aqueous vacuole */}
          <mesh position={[0.025, 0.007, 0.005]} scale={[1.45, 0.22, 0.85]}>
            <sphereGeometry args={[0.068, 20, 14]} />
            <meshPhysicalMaterial
              clearcoat={0.9}
              color={BENCH_COLORS.glass}
              opacity={0.52}
              roughness={0.14}
              transparent
            />
          </mesh>
          {/* Peripheral stained nucleus with dark nucleolus */}
          <mesh position={[-0.088, 0.008, -0.028]} scale={[1.1, 0.35, 0.92]}>
            <sphereGeometry args={[0.026, 18, 14]} />
            <meshStandardMaterial
              color={BIOLOGY_COLORS.onionNucleus}
              roughness={0.44}
            />
          </mesh>
        </group>
      ) : (
        <group position={[0, 0.02, 0]}>
          {/* Irregular methylene-blue stained squamous cheek cell */}
          <mesh scale={[1.12, 0.22, 0.88]}>
            <sphereGeometry args={[0.148, 32, 16]} />
            <meshPhysicalMaterial
              clearcoat={0.6}
              color={BIOLOGY_COLORS.methyleneBlue}
              opacity={0.68}
              roughness={0.32}
              transparent
            />
          </mesh>
          <mesh position={[0, 0.003, 0]} scale={[1.04, 0.24, 0.8]}>
            <sphereGeometry args={[0.136, 28, 14]} />
            <meshPhysicalMaterial
              clearcoat={0.5}
              color={BIOLOGY_COLORS.cheekCell}
              opacity={0.78}
              roughness={0.28}
              transparent
            />
          </mesh>
          <mesh position={[-0.016, 0.009, -0.01]} scale={[1, 0.36, 0.9]}>
            <sphereGeometry args={[0.032, 18, 14]} />
            <meshStandardMaterial
              color={BIOLOGY_COLORS.methyleneDark}
              roughness={0.4}
            />
          </mesh>
        </group>
      )}
      {/* Convex glass cover over field-of-view lens */}
      <mesh position={[0, 0.026, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.23, 40]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.18} />
      </mesh>
    </group>
  );
}

/** Wooden hexagonal HB graphite drawing pencil resting beside the scientific drawing sheet. */
export function GraphitePencil({
  position,
}: {
  readonly position: readonly [number, number, number];
}) {
  return (
    <group position={position} rotation={[0, -0.35, Math.PI / 2]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.008, 0.008, 0.34, 6]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.agarAmber}
          roughness={0.52}
        />
      </mesh>
      <mesh castShadow position={[0, 0.19, 0]}>
        <coneGeometry args={[0.008, 0.042, 12]} />
        <meshStandardMaterial color={BOTANY_COLORS.woodRule} roughness={0.74} />
      </mesh>
      <mesh position={[0, 0.214, 0]}>
        <coneGeometry args={[0.0028, 0.014, 8]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.pencil}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[0, -0.178, 0]}>
        <cylinderGeometry args={[0.0082, 0.0082, 0.018, 12]} />
        <MetalMaterial color={BOTANY_COLORS.brassGold} roughness={0.3} />
      </mesh>
    </group>
  );
}

/** Hook that builds and disposes the cotton-rag drawing sheet CanvasTexture. */
export function useDrawingPaperTexture() {
  const tex = useMemo(() => createPaperTexture(), []);
  useEffect(() => () => tex?.dispose(), [tex]);
  return tex;
}
