import { useThree } from "@react-three/fiber";
import type { DenatureEnzyme } from "@repo/design-system/components/contents/biology/denature/model";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { ENZYME_COLORS } from "@repo/design-system/lib/material/enzyme";
import { Array as Arr } from "effect";

const TILE_WELLS = [-0.22, 0, 0.22] as const;

function DenatureCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 2.25, 4.1] : [0, 1.8, 3.25]}
      cameraTarget={[0, 0.35, 0]}
      fov={38}
      maxDistance={6.5}
      minDistance={1.5}
    />
  );
}

function tubeLiquidColor(enzyme: DenatureEnzyme, digested: boolean) {
  if (enzyme === "amylase") {
    return ENZYME_COLORS.bathWater;
  }
  return digested ? ENZYME_COLORS.albumenClear : ENZYME_COLORS.albumenCloudy;
}

export function DenatureScene({
  digested,
  enzyme,
  intactShare,
  parts,
  thermometerLevel,
}: {
  readonly digested: boolean;
  readonly enzyme: DenatureEnzyme;
  readonly intactShare: number;
  readonly parts: Readonly<
    Record<"bath" | "tube" | "tile" | "thermometer" | "lens", string>
  >;
  readonly thermometerLevel: number;
}) {
  const tubeLiquid = tubeLiquidColor(enzyme, digested);
  const wellColor = digested
    ? ENZYME_COLORS.iodineYellow
    : ENZYME_COLORS.iodineBlueBlack;
  const warp = 1 - intactShare;
  const enzymeColor =
    intactShare > 0.5
      ? ENZYME_COLORS.enzymeIntact
      : ENZYME_COLORS.enzymeDenatured;

  return (
    <group>
      <DenatureCamera />
      {/* Water bath and test tube */}
      <group position={[-0.78, 0, 0]}>
        <mesh castShadow position={[0, 0.36, 0]} receiveShadow>
          <boxGeometry args={[0.92, 0.72, 0.72]} />
          <meshPhysicalMaterial
            color={ENZYME_COLORS.bathGlass}
            opacity={0.34}
            roughness={0.14}
            transparent
          />
        </mesh>
        <mesh position={[0, 0.28, 0]}>
          <boxGeometry args={[0.84, 0.52, 0.64]} />
          <meshPhysicalMaterial
            color={ENZYME_COLORS.bathWater}
            opacity={0.42}
            roughness={0.2}
            transparent
          />
        </mesh>
        <mesh castShadow position={[-0.08, 0.56, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.86, 20]} />
          <meshPhysicalMaterial
            color={tubeLiquid}
            opacity={enzyme === "pepsin" && !digested ? 0.9 : 0.68}
            roughness={0.25}
            transparent
          />
        </mesh>
        {/* Thermometer */}
        <mesh castShadow position={[0.24, 0.58, 0.08]}>
          <cylinderGeometry args={[0.025, 0.025, 0.92, 12]} />
          <meshPhysicalMaterial
            color={ENZYME_COLORS.bathGlass}
            opacity={0.55}
            roughness={0.1}
            transparent
          />
        </mesh>
        <mesh position={[0.24, 0.24 + thermometerLevel * 0.28, 0.08]}>
          <cylinderGeometry
            args={[0.014, 0.014, 0.12 + thermometerLevel * 0.55, 10]}
          />
          <meshStandardMaterial
            color={ENZYME_COLORS.thermometerMercury}
            roughness={0.35}
          />
        </mesh>
        <ThreeLabel
          color={ENZYME_COLORS.labelInk}
          fontSize="compact"
          position={[-0.36, 0.82, 0.36]}
        >
          <span>{parts.bath}</span>
        </ThreeLabel>
        <ThreeLabel
          color={ENZYME_COLORS.labelInk}
          fontSize="compact"
          position={[-0.1, 1.08, 0]}
        >
          <span>{parts.tube}</span>
        </ThreeLabel>
        <ThreeLabel
          color={ENZYME_COLORS.labelInk}
          fontSize="compact"
          position={[0.42, 1.06, 0.1]}
        >
          <span>{parts.thermometer}</span>
        </ThreeLabel>
      </group>

      {/* Porcelain spotting tile */}
      <group position={[0.18, 0.04, 0.42]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.72, 0.08, 0.44]} />
          <meshStandardMaterial
            color={ENZYME_COLORS.albumenCloudy}
            roughness={0.42}
          />
        </mesh>
        {Arr.map(TILE_WELLS, (x) => (
          <mesh key={x} position={[x, 0.044, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.015, 16]} />
            <meshStandardMaterial color={wellColor} roughness={0.3} />
          </mesh>
        ))}
        <ThreeLabel
          color={ENZYME_COLORS.labelInk}
          fontSize="compact"
          position={[0, 0.16, 0.26]}
        >
          <span>{parts.tile}</span>
        </ThreeLabel>
      </group>

      {/* Magnifying lens showing active-site integrity */}
      <group position={[0.92, 0.54, -0.18]}>
        <mesh castShadow>
          <torusGeometry args={[0.44, 0.04, 16, 36]} />
          <meshStandardMaterial
            color={ENZYME_COLORS.lensRim}
            metalness={0.45}
            roughness={0.35}
          />
        </mesh>
        <mesh position={[0, 0, -0.02]}>
          <circleGeometry args={[0.42, 32]} />
          <meshPhysicalMaterial
            color={ENZYME_COLORS.bathGlass}
            opacity={0.22}
            roughness={0.12}
            transparent
          />
        </mesh>
        <group position={[0, -0.04, 0.02]}>
          <mesh castShadow scale={[1.1 + warp * 0.4, 0.85 - warp * 0.25, 0.7]}>
            <sphereGeometry args={[0.2, 18, 14]} />
            <meshStandardMaterial color={enzymeColor} roughness={0.5} />
          </mesh>
          <mesh
            castShadow
            position={[-0.14 - warp * 0.08, 0.12, 0]}
            rotation={[0, 0, warp * 0.8]}
          >
            <sphereGeometry args={[0.11, 14, 10]} />
            <meshStandardMaterial color={enzymeColor} roughness={0.5} />
          </mesh>
          <mesh
            castShadow
            position={[0.14 + warp * 0.08, 0.12, 0]}
            rotation={[0, 0, -warp * 0.8]}
          >
            <sphereGeometry args={[0.11, 14, 10]} />
            <meshStandardMaterial color={enzymeColor} roughness={0.5} />
          </mesh>
        </group>
        <ThreeLabel
          color={ENZYME_COLORS.labelInk}
          fontSize="compact"
          position={[0, 0.56, 0]}
        >
          <span>{parts.lens}</span>
        </ThreeLabel>
      </group>
    </group>
  );
}
