import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import {
  CC0_HOUSEFLY_ASSET,
  CCBY_MOTH_ORCHID_ASSET,
  CCBY_PITCHER_PLANT_ASSET,
} from "@repo/design-system/components/contents/biology/assets";
import type { SpecialNutritionMode } from "@repo/design-system/components/contents/biology/carnivore/model";
import { evaluateSpecialNutrition } from "@repo/design-system/components/contents/biology/carnivore/model";
import { useCarnivoreGeometries } from "@repo/design-system/components/contents/biology/carnivore/specimens";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { useLeafTextures } from "@repo/design-system/components/contents/biology/foliage";
import { BotanicalPot } from "@repo/design-system/components/contents/biology/planter";
import { LivingSpecimen } from "@repo/design-system/components/contents/biology/specimen";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import {
  useVisualReset,
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { SPECIMEN_COLORS } from "@repo/design-system/lib/material/specimen";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";
import { DoubleSide } from "three";

const INSECT_HOME = [0.36, 1.52, 0.16] as const;
/** Where the tallest pitcher opens, the point the fly spirals down to. */
const TRAP_MOUTH = [0.08, 1.2, 0.02] as const;

/** Three pitchers of one clump, each a trap leaf rising from the rhizome and leaning its own way. */
const TRUMPETS = [
  { at: [0.02, 0.02], extent: 1.04, id: "t1", lean: [0.04, -0.07], yaw: 0.3 },
  { at: [-0.09, 0.05], extent: 0.8, id: "t2", lean: [0.16, 0.22], yaw: 2.3 },
  { at: [0.04, -0.09], extent: 0.66, id: "t3", lean: [-0.24, -0.2], yaw: 4.2 },
] as const;

const HAUSTORIA_OFFSETS = [
  { id: "h1", rotZ: Math.PI / 2, x: 0.13, y: 0.56, z: 0.06 },
  { id: "h2", rotZ: Math.PI / 2, x: 0.12, y: 0.86, z: 0.05 },
] as const;

const ORCHID_LEAF_ANGLES = [-2.5, -1.7, -0.8, 0.35, 1.35, 2.3] as const;

function CarnivoreCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.1, 1.56, 3.65] : [0.08, 1.34, 3.05]}
      cameraTarget={[0.04, 0.72, 0]}
      fov={38}
      maxDistance={6}
      minDistance={1.5}
    />
  );
}

function PitcherSpecimen({
  insectLabel,
  trapLabel,
}: {
  readonly insectLabel: string;
  readonly trapLabel: string;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const insectRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  const resetInsect = () => {
    phaseRef.current = 0;
    if (insectRef.current !== null) {
      insectRef.current.position.set(
        INSECT_HOME[0],
        INSECT_HOME[1],
        INSECT_HOME[2]
      );
      insectRef.current.rotation.set(0.08, -2.6, 0.05);
    }
  };

  useVisualStop(resetInsect);
  useVisualReset(resetInsect);

  useFrame((_, delta) => {
    if (!playing || insectRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 0.32;
    const t = phaseRef.current % 1;
    const angle = t * Math.PI * 6;
    const reach = 0.3 * (1 - t * 0.82);
    insectRef.current.position.set(
      TRAP_MOUTH[0] + Math.cos(angle) * reach,
      INSECT_HOME[1] - t * (INSECT_HOME[1] - TRAP_MOUTH[1]),
      TRAP_MOUTH[2] + Math.sin(angle) * reach
    );
    insectRef.current.rotation.set(0.1, -angle - Math.PI / 2, 0.06);
  });

  return (
    <group>
      <BotanicalPot height={0.28} mossy seed={11} topRadius={0.3} />
      {Arr.map(TRUMPETS, (trumpet) => (
        <group
          key={trumpet.id}
          position={[trumpet.at[0], 0.2, trumpet.at[1]]}
          rotation={[trumpet.lean[0], trumpet.yaw, trumpet.lean[1]]}
        >
          <LivingSpecimen
            extent={trumpet.extent}
            heading={0}
            path={CCBY_PITCHER_PLANT_ASSET.path}
            phase={trumpet.yaw}
          />
        </group>
      ))}
      <group
        position={[INSECT_HOME[0], INSECT_HOME[1], INSECT_HOME[2]]}
        ref={insectRef}
        rotation={[0.08, -2.6, 0.05]}
      >
        <LivingSpecimen
          extent={0.2}
          heading={0}
          path={CC0_HOUSEFLY_ASSET.path}
        />
      </group>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.62, 0.74, 0.08]}>
        <span>{trapLabel}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.74, 1.5, 0.08]}>
        <span>{insectLabel}</span>
      </ThreeLabel>
    </group>
  );
}

function ParasiticSpecimen({
  geos,
  haustoriumLabel,
  hostStemLabel,
}: {
  readonly geos: ReturnType<typeof useCarnivoreGeometries>;
  readonly haustoriumLabel: string;
  readonly hostStemLabel: string;
}) {
  const ink = useLabelInk();
  return (
    <group>
      <BotanicalPot height={0.24} mossy seed={17} topRadius={0.28} />
      <mesh castShadow geometry={geos.hostStem} receiveShadow>
        <SurfaceMaterial
          bump={0.62}
          color={SPECIMEN_COLORS.barkHost}
          repeat={[2, 4]}
          roughness={0.7}
          surface="bark"
        />
      </mesh>
      <mesh castShadow geometry={geos.dodderHelix}>
        <meshPhysicalMaterial
          clearcoat={0.38}
          color={BOTANY_COLORS.dodderOrange}
          roughness={0.42}
        />
      </mesh>
      {Arr.map(HAUSTORIA_OFFSETS, (h) => (
        <mesh
          castShadow
          key={h.id}
          position={[h.x, h.y, h.z]}
          rotation={[0, 0, h.rotZ]}
        >
          <coneGeometry args={[0.04, 0.22, 16]} />
          <meshPhysicalMaterial
            clearcoat={0.36}
            color={SPECIMEN_COLORS.dodderPeg}
            roughness={0.4}
          />
        </mesh>
      ))}
      <ThreeLabel color={ink} fontSize="compact" position={[-0.68, 0.96, 0]}>
        <span>{hostStemLabel}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.68, 0.68, 0]}>
        <span>{haustoriumLabel}</span>
      </ThreeLabel>
    </group>
  );
}

function EpiphyticSpecimen({
  aerialRootLabel,
  geos,
  hostStemLabel,
}: {
  readonly aerialRootLabel: string;
  readonly geos: ReturnType<typeof useCarnivoreGeometries>;
  readonly hostStemLabel: string;
}) {
  const ink = useLabelInk();
  const orchidLeafTex = useLeafTextures("orchid");

  return (
    <group>
      <mesh castShadow geometry={geos.branch} receiveShadow>
        <SurfaceMaterial
          bump={0.95}
          color={SPECIMEN_COLORS.barkMossy}
          repeat={[4, 1]}
          roughness={0.9}
          surface="bark"
        />
      </mesh>
      {Arr.map([-0.76, 0.76] as const, (sx) => (
        <mesh castShadow key={`sup-${sx}`} position={[sx, 0.18, 0]}>
          <cylinderGeometry args={[0.06, 0.085, 0.36, 16]} />
          <SurfaceMaterial
            bump={0.85}
            color={SPECIMEN_COLORS.barkDark}
            repeat={[2, 2]}
            roughness={0.9}
            surface="bark"
          />
        </mesh>
      ))}
      <group position={[0, 0.54, 0]}>
        {Arr.map(ORCHID_LEAF_ANGLES, (yaw, idx) => (
          <mesh
            castShadow
            geometry={geos.orchidLeaf}
            key={`ol-${yaw}`}
            receiveShadow
            rotation={[0.08, yaw, 0.26 + (idx % 2) * 0.1]}
          >
            <meshPhysicalMaterial
              bumpMap={orchidLeafTex.bumpMap}
              bumpScale={0.012}
              clearcoat={0.36}
              clearcoatRoughness={0.32}
              map={orchidLeafTex.map}
              roughness={0.44}
              side={DoubleSide}
            />
          </mesh>
        ))}
      </group>
      <group position={[0.08, 0.55, 0.04]} rotation={[0.1, -0.5, -0.1]}>
        <LivingSpecimen
          extent={0.44}
          heading={0}
          path={CCBY_MOTH_ORCHID_ASSET.path}
        />
      </group>
      {Arr.map(geos.aerialRoots, (strand) => (
        <mesh castShadow geometry={strand.geo} key={strand.id}>
          <meshPhysicalMaterial
            clearcoat={0.18}
            color={SPECIMEN_COLORS.velamenRoot}
            roughness={0.72}
          />
        </mesh>
      ))}
      <ThreeLabel color={ink} fontSize="compact" position={[-0.76, 0.64, 0]}>
        <span>{hostStemLabel}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.68, 0.22, 0]}>
        <span>{aerialRootLabel}</span>
      </ThreeLabel>
    </group>
  );
}

export function CarnivorousPlantScene({
  mode,
  parts,
}: {
  readonly mode: SpecialNutritionMode;
  readonly parts: Readonly<
    Record<
      "aerialRoot" | "haustorium" | "hostStem" | "insect" | "trapLeaf",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const profile = evaluateSpecialNutrition(mode);
  const geos = useCarnivoreGeometries();

  return (
    <group>
      <SimulationTicker running={playing} />
      <CarnivoreCamera />
      {profile.trapsInsects ? (
        <PitcherSpecimen
          insectLabel={parts.insect}
          trapLabel={parts.trapLeaf}
        />
      ) : null}
      {profile.tapsHostVascular ? (
        <ParasiticSpecimen
          geos={geos}
          haustoriumLabel={parts.haustorium}
          hostStemLabel={parts.hostStem}
        />
      ) : null}
      {profile.hasChlorophyll && !profile.trapsInsects ? (
        <EpiphyticSpecimen
          aerialRootLabel={parts.aerialRoot}
          geos={geos}
          hostStemLabel={parts.hostStem}
        />
      ) : null}
    </group>
  );
}

useGLTF.preload(CCBY_PITCHER_PLANT_ASSET.path);
useGLTF.preload(CC0_HOUSEFLY_ASSET.path);
