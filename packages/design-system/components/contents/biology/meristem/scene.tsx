import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type {
  GrowthMode,
  PlantOrgan,
} from "@repo/design-system/components/contents/biology/meristem/model";
import {
  evaluatePrimaryZone,
  evaluateSecondaryGrowth,
} from "@repo/design-system/components/contents/biology/meristem/model";
import {
  RootApexCutaway,
  SecondaryWoodCrossSection,
  ShootApexCutaway,
} from "@repo/design-system/components/contents/biology/meristem/tissues";
import { SeamlessBenchSurface } from "@repo/design-system/components/contents/chemistry/surface";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import {
  useVisualReset,
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { FOLIAGE_COLORS } from "@repo/design-system/lib/material/foliage";
import { createContext, use, useCallback, useMemo, useRef } from "react";
import type { Group } from "three";

type MeristemParts = Readonly<
  Record<
    | "annualRing"
    | "apicalMeristem"
    | "corkCambium"
    | "rootCap"
    | "rootHair"
    | "secondaryPhloem"
    | "secondaryXylem"
    | "vacuole"
    | "vascularCambium",
    string
  >
>;

const DEFAULT_PARTS: MeristemParts = {
  annualRing: "",
  apicalMeristem: "",
  corkCambium: "",
  rootCap: "",
  rootHair: "",
  secondaryPhloem: "",
  secondaryXylem: "",
  vacuole: "",
  vascularCambium: "",
};

const MeristemSceneContext = createContext<{
  readonly organ: PlantOrgan;
  readonly parts: MeristemParts;
  readonly position: number;
  readonly years: number;
}>({
  organ: "root",
  parts: DEFAULT_PARTS,
  position: 20,
  years: 3,
});

function MeristemCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [1.65, 1.55, 3.45] : [1.3, 1.35, 2.85]}
      cameraTarget={[0, 0.78, 0]}
      fov={38}
      maxDistance={6}
      minDistance={1.4}
    />
  );
}

function PrimaryApexView() {
  const { organ, parts, position } = use(MeristemSceneContext);
  const ink = useLabelInk();
  const scan = evaluatePrimaryZone(position);
  const isRoot = organ === "root";
  const scanY = isRoot ? scan.axisY : 1.58 - scan.axisY;

  return (
    <group>
      {isRoot ? <RootApexCutaway /> : <ShootApexCutaway />}

      {/* Translucent holographic zone scanner ring */}
      <mesh position={[0, scanY, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.38, 0.018, 12, 40]} />
        <meshStandardMaterial
          color={FOLIAGE_COLORS.scanRing}
          emissive={FOLIAGE_COLORS.scanRing}
          emissiveIntensity={0.45}
          opacity={0.82}
          roughness={0.22}
          transparent
        />
      </mesh>

      {isRoot ? (
        <>
          <ThreeLabel
            anchorX="right"
            color={ink}
            fontSize="compact"
            position={[-0.46, 0.16, 0]}
          >
            <span>{parts.rootCap}</span>
          </ThreeLabel>
          <ThreeLabel
            anchorX="left"
            color={ink}
            fontSize="compact"
            position={[0.74, 1.24, 0]}
          >
            <span>{parts.rootHair}</span>
          </ThreeLabel>
        </>
      ) : null}
      <ThreeLabel
        anchorX="left"
        color={ink}
        fontSize="compact"
        position={[0.52, isRoot ? 0.44 : 1.44, 0]}
      >
        <span>{parts.apicalMeristem}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        color={ink}
        fontSize="compact"
        position={[-0.48, 0.84, 0.08]}
      >
        <span>{parts.vacuole}</span>
      </ThreeLabel>
    </group>
  );
}

function SecondaryTrunkView() {
  const { parts, years } = use(MeristemSceneContext);
  const ink = useLabelInk();
  const cross = evaluateSecondaryGrowth(years);

  return (
    <group>
      <SecondaryWoodCrossSection
        outerRadius={cross.outerRadius}
        ringCount={cross.ringCount}
        xylemRadius={cross.xylemRadius}
      />
      <ThreeLabel color={ink} fontSize="compact" position={[0, 1.04, 0]}>
        <span>{parts.annualRing}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        color={ink}
        fontSize="compact"
        position={[-cross.outerRadius - 0.18, 0.84, 0.12]}
      >
        <span>{parts.vascularCambium}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={ink}
        fontSize="compact"
        position={[cross.outerRadius + 0.18, 0.72, 0]}
      >
        <span>{parts.corkCambium}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={ink}
        fontSize="compact"
        position={[cross.xylemRadius * 0.55, 0.9, cross.xylemRadius * 0.55]}
      >
        <span>{parts.secondaryXylem}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        color={ink}
        fontSize="compact"
        position={[-cross.xylemRadius * 0.55, 0.54, cross.outerRadius * 0.72]}
      >
        <span>{parts.secondaryPhloem}</span>
      </ThreeLabel>
    </group>
  );
}

export function MeristemGrowthScene({
  mode,
  organ,
  parts,
  position,
  years,
}: {
  readonly mode: GrowthMode;
  readonly organ: PlantOrgan;
  readonly parts: MeristemParts;
  readonly position: number;
  readonly years: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const specimenRef = useRef<Group>(null);
  const angleRef = useRef(0);

  const rewind = useCallback(() => {
    angleRef.current = 0;
    if (specimenRef.current !== null) {
      specimenRef.current.rotation.y = 0;
    }
  }, []);
  useVisualStop(rewind);
  useVisualReset(rewind);

  useFrame((_, delta) => {
    if (!playing || specimenRef.current === null) {
      return;
    }
    angleRef.current += simulationStep(delta) * 0.4;
    specimenRef.current.rotation.y = Math.sin(angleRef.current) * 0.28;
  });

  const sceneValue = useMemo(
    () => ({ organ, parts, position, years }),
    [organ, parts, position, years]
  );

  return (
    <MeristemSceneContext value={sceneValue}>
      <group>
        <SimulationTicker running={playing} />
        <MeristemCamera />
        <SeamlessBenchSurface radius={14} y={0} />
        <group ref={specimenRef}>
          {mode === "primary" ? <PrimaryApexView /> : <SecondaryTrunkView />}
        </group>
      </group>
    </MeristemSceneContext>
  );
}
