import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { Airflow } from "@repo/design-system/components/three/energy/airflow";
import { Turbine } from "@repo/design-system/components/three/energy/turbine";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Slider } from "@repo/design-system/components/ui/slider";
import {
  useVisualReset,
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

const MIN_WIND_SPEED = 3;
const MAX_WIND_SPEED = 12;
const DEFAULT_WIND_SPEED = 7;

/** The rotor's real radius, in metres, and its radius in the scene. */
const ROTOR_METRES = 40;
const ROTOR_RADIUS = 0.78;

interface WindEnergyConversionLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    flow: ReactNode;
    flowLabel: string;
    meaning: ReactNode;
    meaningLabel: string;
    speedControl: string;
    speedUnit: string;
    viewLabel: string;
  };
  title: NonNullable<ReactNode>;
}

/**
 * Shows wind energy conversion as one interactive 3D system: moving air turns a
 * rotor while the nacelle houses the generator.
 */
export function WindEnergyConversionLab({
  description,
  labels,
  title,
}: WindEnergyConversionLabProps) {
  const [windSpeed, setWindSpeed] = useState(DEFAULT_WIND_SPEED);

  function handleSpeedChange(nextValue: number) {
    setWindSpeed(nextValue);
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.speedControl}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={`${windSpeed}\\ \\text{${labels.speedUnit}}`} />
            </span>
          </div>
          <Slider
            aria-label={labels.speedControl}
            max={MAX_WIND_SPEED}
            min={MIN_WIND_SPEED}
            onValueChange={handleSpeedChange}
            step={1}
            value={windSpeed}
          />
        </div>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage
          floor={0}
          frameloop="always"
          ground="grass"
          reach={3.6}
          setting="field"
        >
          <Suspense>
            <CameraControls
              cameraPosition={[2.9, 1.3, 5.2]}
              cameraTarget={[0, 1.2, 0.1]}
              fov={34}
              framing="content"
            />
            <WindConversionScene
              onReset={() => setWindSpeed(DEFAULT_WIND_SPEED)}
              windSpeed={windSpeed}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={labels.flowLabel} value={labels.flow} />
          <VisualFact label={labels.meaningLabel} value={labels.meaning} />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * The turbine in the wind the slider sets: the rotor turns at the rate that
 * wind gives an 80 m rotor, and smoke streaks show the air slowing as it
 * hands its energy to the blades.
 */
function WindConversionScene({
  onReset,
  windSpeed,
}: {
  onReset: () => void;
  windSpeed: number;
}) {
  useVisualReset(onReset);

  return (
    <group>
      <Turbine metres={ROTOR_METRES} radius={ROTOR_RADIUS} wind={windSpeed} />
      <CameraBounds exclude>
        <Airflow metres={ROTOR_METRES} radius={ROTOR_RADIUS} wind={windSpeed} />
      </CameraBounds>
    </group>
  );
}
