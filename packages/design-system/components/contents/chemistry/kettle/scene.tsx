import { useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import type { SaponificationStep } from "@repo/design-system/components/contents/chemistry/kettle/model";
import { evaluateSaponificationStep } from "@repo/design-system/components/contents/chemistry/kettle/model";
import { MoldingStation } from "@repo/design-system/components/contents/chemistry/kettle/molding";
import {
  FiltrationContents,
  HydrolysisContents,
  SaltingOutContents,
} from "@repo/design-system/components/contents/chemistry/kettle/stages";
import {
  AnchorAgitator,
  KETTLE_Z,
  KettleVessel,
} from "@repo/design-system/components/contents/chemistry/kettle/vessel";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";

function KettleCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.05, 0.36, 1.24] : [0.06, 0.31, 0.96]}
      cameraTarget={[0, 0.22, KETTLE_Z]}
      fov={38}
      maxDistance={2.2}
      minDistance={0.32}
    />
  );
}

export function SaponificationKettleScene({
  parts,
  step,
}: {
  readonly parts: Readonly<
    Record<
      "alkaliStream" | "kettle" | "saltLayer" | "soapCurd" | "triglyceride",
      string
    >
  >;
  readonly step: SaponificationStep;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const labelInk = useLabelInk();
  const state = evaluateSaponificationStep(step);

  return (
    <group>
      <SimulationTicker running={playing} />
      <KettleCamera />
      <LabBench width={2.6} />

      {state.isMolded ? (
        <MoldingStation playing={playing} />
      ) : (
        <group>
          <KettleVessel />
          <AnchorAgitator playing={playing} spinning={step !== "filtration"} />
          {step === "hydrolysis" ? (
            <HydrolysisContents playing={playing} />
          ) : null}
          {step === "saltingOut" ? (
            <SaltingOutContents
              curdHeight={state.curdHeight}
              playing={playing}
            />
          ) : null}
          {step === "filtration" ? (
            <FiltrationContents
              curdHeight={state.curdHeight}
              playing={playing}
            />
          ) : null}
        </group>
      )}

      {state.isMolded ? (
        <ThreeLabel
          color={labelInk}
          fontSize="compact"
          position={[0, 0.285, KETTLE_Z]}
        >
          <span>{parts.soapCurd}</span>
        </ThreeLabel>
      ) : (
        <group>
          <ThreeLabel
            color={labelInk}
            fontSize="compact"
            position={[-0.21, 0.455, KETTLE_Z]}
          >
            <span>{parts.alkaliStream}</span>
          </ThreeLabel>
          <ThreeLabel
            anchorX="right"
            color={labelInk}
            fontSize="compact"
            position={[-0.17, 0.235, KETTLE_Z + 0.04]}
          >
            <span>{parts.kettle}</span>
          </ThreeLabel>
          <ThreeLabel
            color={labelInk}
            fontSize="compact"
            position={[0.2, 0.47, KETTLE_Z + 0.03]}
          >
            <span>{parts.soapCurd}</span>
          </ThreeLabel>
          <ThreeLabel
            anchorX="left"
            color={labelInk}
            fontSize="compact"
            position={[0.175, 0.145, KETTLE_Z + 0.04]}
          >
            <span>{state.hasBrine ? parts.saltLayer : parts.triglyceride}</span>
          </ThreeLabel>
        </group>
      )}
    </group>
  );
}
