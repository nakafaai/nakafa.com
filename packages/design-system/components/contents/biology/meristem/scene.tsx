import { useFrame } from "@react-three/fiber";
import { Leader } from "@repo/design-system/components/contents/biology/leader";
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
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import {
  useVisualReset,
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
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

/** What the camera fills the frame with when an organ is cut along its length: the organ standing on the bench. */
const ORGAN_ROOM = {
  x: { max: 0.62, min: -0.62 },
  y: { max: 1.46, min: 0 },
  z: { max: 0.05, min: -0.05 },
} as const;

/** The zone of the engine's cell files that each zone of the lab's model lights up. */
const LIT_ZONES = {
  differentiation: "mature",
  division: "division",
  elongation: "elongation",
} as const;

/** How far in front of the cut face a leader ends, so it stops on the cells and not inside them. */
const FACE = 0.05;

function MeristemCamera() {
  return (
    <CameraControls
      cameraPosition={[1.3, 1.35, 2.85]}
      cameraTarget={[0, 0.78, 0]}
      fov={38}
      framing="content"
    />
  );
}

/**
 * The tip of a root or shoot cut along its length. The zone the reader has
 * chosen is marked on the specimen itself: its cells keep their full colour
 * and the cells of every other zone fade.
 */
function PrimaryApexView() {
  const { organ, parts, position } = use(MeristemSceneContext);
  const lit = LIT_ZONES[evaluatePrimaryZone(position).zone];

  if (organ === "root") {
    return (
      <group>
        <CameraBounds bounds={ORGAN_ROOM}>
          <RootApexCutaway lit={lit} />
        </CameraBounds>
        <Leader anchorX="right" at={[-0.2, 0.05, 0]} to={[-0.07, 0.07, FACE]}>
          <span>{parts.rootCap}</span>
        </Leader>
        <Leader anchorY="bottom" at={[0.5, 1.46, 0]} to={[0.44, 1.2, -0.12]}>
          <span>{parts.rootHair}</span>
        </Leader>
        <Leader anchorX="left" at={[0.36, 0.34, 0]} to={[0.12, 0.34, FACE]}>
          <span>{parts.apicalMeristem}</span>
        </Leader>
        <Leader anchorX="right" at={[-0.36, 0.78, 0]} to={[-0.12, 0.78, FACE]}>
          <span>{parts.vacuole}</span>
        </Leader>
      </group>
    );
  }

  return (
    <group>
      <CameraBounds bounds={ORGAN_ROOM}>
        <ShootApexCutaway lit={lit} />
      </CameraBounds>
      <Leader anchorY="bottom" at={[0.2, 1.6, 0]} to={[0.04, 1.32, FACE]}>
        <span>{parts.apicalMeristem}</span>
      </Leader>
      <Leader anchorX="right" at={[-0.36, 0.7, 0]} to={[-0.12, 0.7, FACE]}>
        <span>{parts.vacuole}</span>
      </Leader>
    </group>
  );
}

/** A point on the sawn face of the log, `reach` out from the pith and `turn` from the right toward the reader. */
function onFace(reach: number, turn: number) {
  return [reach * Math.cos(turn), 0.556, reach * Math.sin(turn)] as const;
}

/**
 * The sawn log with its labels in a column beside it. The higher a label
 * stands, the farther back on the face is the part it names, so no two
 * leaders cross and none crosses a label.
 */
function SecondaryTrunkView() {
  const { parts, years } = use(MeristemSceneContext);
  const cross = evaluateSecondaryGrowth(years);
  const column = cross.outerRadius + 0.1;

  return (
    <group>
      <CameraBounds
        bounds={{
          x: { max: cross.outerRadius, min: -cross.outerRadius },
          y: { max: 0.6, min: 0 },
          z: { max: 0.05, min: -0.05 },
        }}
      >
        <SecondaryWoodCrossSection
          outerRadius={cross.outerRadius}
          ringCount={cross.ringCount}
          xylemRadius={cross.xylemRadius}
        />
      </CameraBounds>
      <Leader
        anchorX="left"
        at={[column, 0.98, 0]}
        to={onFace(cross.xylemRadius * 0.55, -1)}
      >
        <span>{parts.annualRing}</span>
      </Leader>
      <Leader
        anchorX="left"
        at={[column, 0.84, 0]}
        to={onFace(cross.xylemRadius * 0.78, -0.45)}
      >
        <span>{parts.secondaryXylem}</span>
      </Leader>
      <Leader
        anchorX="left"
        at={[column, 0.7, 0]}
        to={onFace(cross.xylemRadius, -0.1)}
      >
        <span>{parts.vascularCambium}</span>
      </Leader>
      <Leader
        anchorX="left"
        at={[column, 0.56, 0]}
        to={onFace(cross.xylemRadius + 0.035, 0.3)}
      >
        <span>{parts.secondaryPhloem}</span>
      </Leader>
      <Leader
        anchorX="left"
        at={[column, 0.42, 0]}
        to={onFace(cross.outerRadius - 0.03, 0.62)}
      >
        <span>{parts.corkCambium}</span>
      </Leader>
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
        <group ref={specimenRef}>
          {mode === "primary" ? <PrimaryApexView /> : <SecondaryTrunkView />}
        </group>
      </group>
    </MeristemSceneContext>
  );
}
