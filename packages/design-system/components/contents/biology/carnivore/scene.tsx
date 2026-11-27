import { useFrame, useThree } from "@react-three/fiber";
import type { SpecialNutritionMode } from "@repo/design-system/components/contents/biology/carnivore/model";
import { evaluateSpecialNutrition } from "@repo/design-system/components/contents/biology/carnivore/model";
import { useCarnivoreGeometries } from "@repo/design-system/components/contents/biology/carnivore/specimens";
import { usePitcherTextures } from "@repo/design-system/components/contents/biology/carnivore/textures";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { HoverflyPrey } from "@repo/design-system/components/contents/biology/entomology";
import {
  useLeafTextures,
  usePetalTextures,
  useStemTextures,
} from "@repo/design-system/components/contents/biology/foliage";
import { BotanicalPot } from "@repo/design-system/components/contents/biology/planter";
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

const INSECT_HOME = [0.46, 1.3, 0.16] as const;

const BASAL_LEAVES = [
  { id: "bl1", rot: [0.1, 2.85, 0.22] as const, scale: 1.02 },
  { id: "bl2", rot: [0.14, 1.65, 0.3] as const, scale: 0.9 },
  { id: "bl3", rot: [0.12, -2.25, 0.26] as const, scale: 0.86 },
  { id: "bl4", rot: [0.16, -0.75, 0.34] as const, scale: 0.78 },
] as const;

const HAUSTORIA_OFFSETS = [
  { id: "h1", rotZ: Math.PI / 2, x: 0.13, y: 0.56, z: 0.06 },
  { id: "h2", rotZ: Math.PI / 2, x: 0.12, y: 0.86, z: 0.05 },
] as const;

const ORCHID_LEAF_ANGLES = [-2.5, -1.7, -0.8, 0.35, 1.35, 2.3] as const;
const ORCHID_PETAL_ANGLES = [0, 1.25, 2.5, 3.75, 5.0] as const;

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
  geos,
  insectLabel,
  trapLabel,
}: {
  readonly geos: ReturnType<typeof useCarnivoreGeometries>;
  readonly insectLabel: string;
  readonly trapLabel: string;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const insectRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const pitcherTex = usePitcherTextures();
  const leafTex = useLeafTextures("healthy");
  const stemTex = useStemTextures();

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
    phaseRef.current += simulationStep(delta) * 0.95;
    const t = phaseRef.current % 1;
    const angle = t * Math.PI * 2;
    const hoverX = 0.24 + Math.cos(angle) * 0.22;
    const hoverY = 1.28 - t * 0.48 + Math.sin(angle * 2) * 0.03;
    const hoverZ = 0.1 + Math.sin(angle) * 0.14;
    insectRef.current.position.set(hoverX, hoverY, hoverZ);
    insectRef.current.rotation.set(0.1, -angle - Math.PI * 0.65, 0.06);
  });

  return (
    <group>
      <group position={[-0.24, 0, -0.04]}>
        <BotanicalPot height={0.28} mossy seed={11} topRadius={0.28} />
        <group position={[0, 0.26, 0]}>
          {Arr.map(BASAL_LEAVES, (lf) => (
            <mesh
              castShadow
              geometry={geos.basalLeaf}
              key={lf.id}
              receiveShadow
              rotation={[lf.rot[0], lf.rot[1], lf.rot[2]]}
              scale={lf.scale}
            >
              <meshPhysicalMaterial
                bumpMap={leafTex.bumpMap}
                bumpScale={0.014}
                clearcoat={0.28}
                clearcoatRoughness={0.36}
                map={leafTex.map}
                roughness={0.5}
                roughnessMap={leafTex.roughnessMap}
                side={DoubleSide}
              />
            </mesh>
          ))}
        </group>
      </group>
      <mesh castShadow geometry={geos.tendril} receiveShadow>
        <meshPhysicalMaterial
          bumpMap={stemTex.bumpMap}
          bumpScale={0.01}
          map={stemTex.map}
          roughness={0.56}
        />
      </mesh>
      <group position={[0.16, 0.32, 0.02]}>
        <mesh castShadow geometry={geos.pitcher} receiveShadow>
          <meshPhysicalMaterial
            bumpMap={pitcherTex.bodyBump}
            bumpScale={0.016}
            clearcoat={0.46}
            clearcoatRoughness={0.28}
            map={pitcherTex.bodyMap}
            roughness={0.44}
            side={DoubleSide}
          />
        </mesh>
        <mesh geometry={geos.cutawayGlass}>
          <meshPhysicalMaterial
            clearcoat={0.6}
            color={SPECIMEN_COLORS.pitcherCutaway}
            depthWrite={false}
            opacity={0.24}
            roughness={0.22}
            side={DoubleSide}
            transparent
          />
        </mesh>
        <mesh geometry={geos.digestiveFluid}>
          <meshPhysicalMaterial
            clearcoat={0.92}
            clearcoatRoughness={0.08}
            color={SPECIMEN_COLORS.pitcherFluid}
            ior={1.34}
            opacity={0.72}
            roughness={0.14}
            transparent
          />
        </mesh>
        <mesh castShadow geometry={geos.peristome} position={[0, 0.77, 0]}>
          <meshPhysicalMaterial
            bumpMap={pitcherTex.rimBump}
            bumpScale={0.024}
            clearcoat={0.85}
            clearcoatRoughness={0.12}
            map={pitcherTex.rimMap}
            roughness={0.24}
          />
        </mesh>
        <mesh castShadow geometry={geos.lidNeck}>
          <meshPhysicalMaterial
            bumpMap={stemTex.bumpMap}
            bumpScale={0.01}
            map={stemTex.map}
            roughness={0.48}
          />
        </mesh>
        <mesh castShadow geometry={geos.dorsalSpur}>
          <meshStandardMaterial
            color={SPECIMEN_COLORS.pitcherSpur}
            roughness={0.54}
          />
        </mesh>
        <mesh
          castShadow
          geometry={geos.lid}
          position={[0, 0.93, -0.17]}
          receiveShadow
          rotation={[-0.28, 0, 0]}
        >
          <meshPhysicalMaterial
            bumpMap={leafTex.bumpMap}
            bumpScale={0.014}
            clearcoat={0.34}
            clearcoatRoughness={0.34}
            map={pitcherTex.lidMap}
            roughness={0.46}
            side={DoubleSide}
          />
        </mesh>
      </group>
      <group
        position={[INSECT_HOME[0], INSECT_HOME[1], INSECT_HOME[2]]}
        ref={insectRef}
        rotation={[0.08, -2.6, 0.05]}
        scale={1.55}
      >
        <HoverflyPrey playing={playing} />
      </group>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.68, 0.78, 0.08]}>
        <span>{trapLabel}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.96, 1.38, 0.08]}>
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
  const orchidPetalTex = usePetalTextures("orchid");

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
      <mesh castShadow geometry={geos.flowerStem}>
        <meshStandardMaterial
          color={SPECIMEN_COLORS.orchidStem}
          roughness={0.5}
        />
      </mesh>
      <group position={[0.15, 0.96, 0.08]} rotation={[0.28, 0.1, 0]}>
        {Arr.map(ORCHID_PETAL_ANGLES, (ang) => (
          <mesh
            castShadow
            geometry={geos.orchidPetal}
            key={`op-${ang}`}
            rotation={[Math.PI / 2, ang, 0.2]}
          >
            <meshPhysicalMaterial
              bumpMap={orchidPetalTex.bumpMap}
              bumpScale={0.008}
              map={orchidPetalTex.map}
              roughness={0.44}
              side={DoubleSide}
            />
          </mesh>
        ))}
        <mesh position={[0, -0.02, 0.028]} scale={[0.9, 1.15, 0.7]}>
          <sphereGeometry args={[0.036, 14, 10]} />
          <meshPhysicalMaterial
            clearcoat={0.4}
            color={SPECIMEN_COLORS.orchidLabellum}
            roughness={0.38}
          />
        </mesh>
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
          geos={geos}
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
