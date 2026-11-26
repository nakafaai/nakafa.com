import { useThree } from "@react-three/fiber";
import {
  useBroadleafTree,
  usePineTree,
  useShrubGeometry,
} from "@repo/design-system/components/contents/biology/canopy";
import {
  useFernRosette,
  useFoliageMaterial,
  useGrassClump,
  useLichenPatch,
  useMossCushion,
} from "@repo/design-system/components/contents/biology/flora";
import type {
  SuccessionPathway,
  SuccessionStage,
} from "@repo/design-system/components/contents/biology/succession/model";
import { evaluateSuccessionStage } from "@repo/design-system/components/contents/biology/succession/model";
import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { BIOME_COLORS } from "@repo/design-system/lib/material/biome";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  BoxGeometry,
  CatmullRomCurve3,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from "three";

const ROCK_OUTCROPS = [
  {
    id: "rk1",
    pos: [-0.92, 0.14, 0.24] as const,
    rot: [0.1, 0.4, -0.15] as const,
    scale: [0.38, 0.16, 0.28] as const,
  },
  {
    id: "rk2",
    pos: [-0.66, 0.12, -0.32] as const,
    rot: [-0.08, 1.2, 0.1] as const,
    scale: [0.3, 0.14, 0.24] as const,
  },
  {
    id: "rk3",
    pos: [-1.05, 0.1, -0.14] as const,
    rot: [0.14, 2.1, 0.08] as const,
    scale: [0.22, 0.12, 0.2] as const,
  },
] as const;

/** Sculpted weathered geological bedrock block and organic undulating humus horizon. */
function useSoilStrata() {
  const strata = useMemo(() => {
    const bedrock = new BoxGeometry(2.45, 0.26, 1.65, 24, 4, 18);
    const bPos = bedrock.getAttribute("position");
    for (let i = 0; i < bPos.count; i += 1) {
      const x = bPos.getX(i);
      const y = bPos.getY(i);
      const z = bPos.getZ(i);
      const rough = (valueNoise(x * 3.8 + 4, z * 3.8 + y * 5, 32) - 0.5) * 0.09;
      bPos.setXYZ(
        i,
        x + rough * 0.5,
        y + (y > 0 ? rough * 0.7 : 0),
        z + rough * 0.5
      );
    }
    bedrock.computeVertexNormals();

    const humus = new BoxGeometry(2.4, 1, 1.6, 26, 4, 18);
    const hPos = humus.getAttribute("position");
    for (let i = 0; i < hPos.count; i += 1) {
      const x = hPos.getX(i);
      const y = hPos.getY(i);
      const z = hPos.getZ(i);
      const undulate = (valueNoise(x * 2.4 + 11, z * 2.4 + 7, 32) - 0.5) * 0.16;
      hPos.setXYZ(i, x, y + (y > 0 ? undulate : 0), z);
    }
    humus.computeVertexNormals();

    const rock = new SphereGeometry(1, 20, 14);
    const rPos = rock.getAttribute("position");
    for (let i = 0; i < rPos.count; i += 1) {
      const x = rPos.getX(i);
      const y = rPos.getY(i);
      const z = rPos.getZ(i);
      const crag = 0.76 + 0.42 * valueNoise(x * 4.5 + 3, y * 4.5 + z * 4.5, 32);
      rPos.setXYZ(i, x * crag, y * crag, z * crag);
    }
    rock.computeVertexNormals();

    const logCurve = new CatmullRomCurve3([
      new Vector3(-1.02, 0.04, -0.34),
      new Vector3(-0.74, 0.07, -0.26),
      new Vector3(-0.46, 0.05, -0.38),
    ]);
    const charredLog = new TubeGeometry(logCurve, 16, 0.068, 10, false);

    return { bedrock, charredLog, humus, rock };
  }, []);
  useEffect(
    () => () => {
      strata.bedrock.dispose();
      strata.humus.dispose();
      strata.rock.dispose();
      strata.charredLog.dispose();
    },
    [strata]
  );
  return strata;
}

function SuccessionCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.46, 1.75, 4.25] : [0.42, 1.5, 3.55]}
      cameraTarget={[0.04, 0.72, 0]}
      fov={36}
      maxDistance={6.8}
      minDistance={1.5}
    />
  );
}

export function EcologicalSuccessionScene({
  parts,
  pathway,
  stage,
}: {
  readonly parts: Readonly<
    Record<
      "bedrock" | "canopyTree" | "pioneerPlant" | "shrubLayer" | "topsoil",
      string
    >
  >;
  readonly pathway: SuccessionPathway;
  readonly stage: SuccessionStage;
}) {
  const metrics = evaluateSuccessionStage(pathway, stage);
  const soilH = Math.max(0.03, metrics.soilDepthCm * 0.0082);
  const surfaceY = 0.24 + soilH;
  const hasPioneer = stage !== "bareRock" || pathway === "secondary";
  const hasShrub =
    stage === "grassShrub" ||
    stage === "youngWoodland" ||
    stage === "climaxForest";
  const hasCanopy = stage === "youngWoodland" || stage === "climaxForest";
  const isClimax = stage === "climaxForest";

  const { bedrock, charredLog, humus, rock } = useSoilStrata();
  const foliageMat = useFoliageMaterial();
  const lichen = useLichenPatch(11);
  const moss = useMossCushion(12);
  const grass = useGrassClump(13, 14);
  const fern = useFernRosette(14);
  const shrub = useShrubGeometry(15);
  const pine = usePineTree(16);
  const oak = useBroadleafTree(17);

  return (
    <group>
      <SuccessionCamera />

      {/* Sculpted fractured bedrock geological horizon */}
      <mesh castShadow geometry={bedrock} position={[0, 0.13, 0]} receiveShadow>
        <SurfaceMaterial
          bump={0.8}
          color={BIOME_COLORS.bedrockSlate}
          repeat={[3, 2]}
          roughness={0.92}
          surface="concrete"
        />
      </mesh>

      {/* Weathered bedrock outcrops on pioneer side */}
      {Arr.map(ROCK_OUTCROPS, (rk) => (
        <mesh
          castShadow
          geometry={rock}
          key={rk.id}
          position={[rk.pos[0], rk.pos[1] + soilH * 0.45, rk.pos[2]]}
          receiveShadow
          rotation={rk.rot}
          scale={rk.scale}
        >
          <SurfaceMaterial
            bump={0.9}
            color={BIOME_COLORS.bedrockDark}
            roughness={0.94}
            surface="concrete"
          />
        </mesh>
      ))}

      {/* Organic undulating humus/topsoil horizon thickening across succession */}
      <mesh
        castShadow
        geometry={humus}
        position={[0, 0.24 + soilH * 0.5, 0]}
        receiveShadow
        scale={[1, soilH, 1]}
      >
        <SurfaceMaterial
          bump={0.75}
          color={BIOME_COLORS.humusBrown}
          repeat={[4, 3]}
          roughness={0.9}
          surface="bark"
        />
      </mesh>

      {/* Secondary succession charred fallen remnant timber */}
      {pathway === "secondary" ? (
        <mesh
          castShadow
          geometry={charredLog}
          position={[0, surfaceY - 0.01, 0]}
        >
          <SurfaceMaterial
            bump={1}
            color={BIOME_COLORS.charredWood}
            repeat={[2, 1]}
            roughness={0.95}
            surface="bark"
          />
        </mesh>
      ) : null}

      {/* Pioneer stage: foliose lichen rosettes, moss cushions, and pioneer grass tufts */}
      {hasPioneer ? (
        <group position={[0, surfaceY - 0.01, 0]}>
          <mesh
            castShadow
            geometry={lichen}
            material={foliageMat}
            position={[-0.86, 0.05, 0.22]}
            scale={1.05}
          />
          <mesh
            castShadow
            geometry={moss}
            material={foliageMat}
            position={[-0.64, 0, 0.36]}
            scale={1.05}
          />
          <mesh
            castShadow
            geometry={grass}
            material={foliageMat}
            position={[-0.56, 0, 0.06]}
            scale={0.85}
          />
          <mesh
            castShadow
            geometry={grass}
            material={foliageMat}
            position={[-0.36, 0, 0.42]}
            rotation={[0, 1.3, 0]}
            scale={0.9}
          />
        </group>
      ) : null}

      {/* Grass & shrub stage: woody multi-stemmed shrubs + woodland ferns + meadow tufts */}
      {hasShrub ? (
        <group position={[0, surfaceY - 0.01, 0]}>
          <mesh
            castShadow
            geometry={shrub}
            material={foliageMat}
            position={[-0.08, 0, 0.22]}
            scale={1.08}
          />
          <mesh
            castShadow
            geometry={shrub}
            material={foliageMat}
            position={[0.14, 0, -0.34]}
            rotation={[0, 2.1, 0]}
            scale={0.84}
          />
          <mesh
            castShadow
            geometry={fern}
            material={foliageMat}
            position={[-0.32, 0, -0.06]}
            scale={0.85}
          />
          <mesh
            castShadow
            geometry={grass}
            material={foliageMat}
            position={[0.24, 0, 0.46]}
            scale={1.05}
          />
        </group>
      ) : null}

      {/* Young woodland & climax forest canopy trees with textured bark trunks */}
      {hasCanopy ? (
        <group position={[0, surfaceY - 0.02, 0]}>
          {/* Conifer pine tree */}
          <group position={[0.58, 0, -0.18]} scale={isClimax ? 1.15 : 0.88}>
            <mesh castShadow geometry={pine.trunk} receiveShadow>
              <SurfaceMaterial
                bump={0.95}
                color={BIOME_COLORS.barkDark}
                repeat={[2, 4]}
                roughness={0.92}
                surface="bark"
              />
            </mesh>
            <mesh
              castShadow
              geometry={pine.foliage}
              material={foliageMat}
              receiveShadow
            />
          </group>
          {/* Mature broadleaf oak tree emerging in climax forest */}
          {isClimax ? (
            <group position={[0.88, 0, 0.28]} scale={0.96}>
              <mesh castShadow geometry={oak.trunk} receiveShadow>
                <SurfaceMaterial
                  bump={0.95}
                  color={BIOME_COLORS.barkWarm}
                  repeat={[2, 4]}
                  roughness={0.9}
                  surface="bark"
                />
              </mesh>
              <mesh
                castShadow
                geometry={oak.foliage}
                material={foliageMat}
                receiveShadow
              />
            </group>
          ) : null}
          {/* Forest floor ferns under canopy */}
          <mesh
            castShadow
            geometry={fern}
            material={foliageMat}
            position={[0.42, 0, 0.24]}
            rotation={[0, 0.9, 0]}
            scale={0.78}
          />
        </group>
      ) : null}

      {/* Labels (shown only for active visible layers) */}
      <ThreeLabel
        color={BIOME_COLORS.labelInk}
        fontSize="compact"
        position={[-0.95, 0.14, 0.9]}
      >
        <span>{parts.bedrock}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BIOME_COLORS.labelInk}
        fontSize="compact"
        position={[0.92, 0.26 + soilH, 0.88]}
      >
        <span>{parts.topsoil}</span>
      </ThreeLabel>
      {hasPioneer ? (
        <ThreeLabel
          color={BIOME_COLORS.labelInk}
          fontSize="compact"
          position={[-0.84, surfaceY + 0.36, 0.28]}
        >
          <span>{parts.pioneerPlant}</span>
        </ThreeLabel>
      ) : null}
      {hasShrub ? (
        <ThreeLabel
          color={BIOME_COLORS.labelInk}
          fontSize="compact"
          position={[-0.08, surfaceY + 0.56, 0.22]}
        >
          <span>{parts.shrubLayer}</span>
        </ThreeLabel>
      ) : null}
      {hasCanopy ? (
        <ThreeLabel
          color={BIOME_COLORS.labelInk}
          fontSize="compact"
          position={[0.64, surfaceY + (isClimax ? 1.52 : 1.18), -0.16]}
        >
          <span>{parts.canopyTree}</span>
        </ThreeLabel>
      ) : null}
    </group>
  );
}
