import {
  boilTime,
  ELEMENT_POWER,
  FILL_MASS,
  type Fill,
  FillSchema,
  heatNeeded,
  TEMPERATURE_RISE,
} from "@repo/design-system/components/contents/physics/renewable-energy/kettle/heating";
import { KettleScene } from "@repo/design-system/components/contents/physics/renewable-energy/kettle/scene";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr, Schema } from "effect";
import { type ReactNode, Suspense, useState } from "react";

interface KettleHeatingLabProps {
  description: ReactNode;
  /** How full the kettle starts. */
  fill?: Fill;
  labels: {
    chooseFill: string;
    energy: ReactNode;
    power: ReactNode;
    rise: ReactNode;
    time: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * An electric kettle boils 0.5 kg, 1 kg or 1.5 kg of water from 25 °C.
 * Electrical work crosses into the kettle and the water stores it as
 * internal energy, Q = m c ΔT, so twice the water needs twice the energy and,
 * at the same 2100 W, twice the time.
 */
export function KettleHeatingLab({
  description,
  fill: initialFill = "full",
  labels,
  title,
}: KettleHeatingLabProps) {
  const [fill, setFill] = useState<Fill>(initialFill);
  const measure = useQuantity();
  const isFill = Schema.is(FillSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseFill}
          gridColumns="3"
          onValueChange={(value) => {
            if (isFill(value)) {
              setFill(value);
            }
          }}
          type="single"
          value={fill}
          variant="outline"
        >
          {Arr.map(FillSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              <InlineMath math={measure(FILL_MASS[option], "\\text{ kg}", 1)} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} frameloop="always" reach={0.5} setting="lab">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[0.45, 0.42, 0.75]}
              cameraTarget={[0.03, 0.13, 0]}
              fov={32}
              maxDistance={1.8}
              minDistance={0.35}
            />
            <KettleScene fill={fill} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.power}
            value={
              <InlineMath math={measure(ELEMENT_POWER, "\\text{ W}", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.rise}
            value={
              <InlineMath math={measure(TEMPERATURE_RISE, "\\text{ K}", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.energy}
            value={
              <InlineMath math={measure(heatNeeded(fill), "\\text{ J}", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.time}
            value={
              <InlineMath math={measure(boilTime(fill), "\\text{ s}", 0)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
