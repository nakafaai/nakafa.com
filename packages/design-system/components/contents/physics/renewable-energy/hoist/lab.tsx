import {
  CRATE_WEIGHT,
  LIFT_ENERGY,
  LIFT_HEIGHT,
  liftSpeed,
  liftTime,
  MOTOR_POWER,
  type Motor,
  MotorSchema,
} from "@repo/design-system/components/contents/physics/renewable-energy/hoist/lift";
import { HoistScene } from "@repo/design-system/components/contents/physics/renewable-energy/hoist/scene";
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

interface HoistWorkLabProps {
  description: ReactNode;
  labels: {
    chooseMotor: string;
    energy: ReactNode;
    height: ReactNode;
    speed: ReactNode;
    time: ReactNode;
    viewLabel: string;
    weight: ReactNode;
  };
  /** The motor the hoist runs on first. */
  motor?: Motor;
  title: ReactNode;
}

/**
 * A motor hoist on a scaffold tower lifts a 20 kg crate 5 m onto a platform.
 * The crate always gains its 200 N weight times 5 m, 1000 J, so a stronger
 * motor only does the same work sooner: energy is force times distance, power
 * is energy per second.
 */
export function HoistWorkLab({
  description,
  labels,
  motor: initialMotor = "medium",
  title,
}: HoistWorkLabProps) {
  const [motor, setMotor] = useState<Motor>(initialMotor);
  const measure = useQuantity();
  const isMotor = Schema.is(MotorSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseMotor}
          gridColumns="3"
          onValueChange={(value) => {
            if (isMotor(value)) {
              setMotor(value);
            }
          }}
          type="single"
          value={motor}
          variant="outline"
        >
          {Arr.map(MotorSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              <InlineMath
                math={measure(MOTOR_POWER[option], "\\text{ W}", 0)}
              />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} frameloop="always" reach={5} setting="studio">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[7.5, 5.2, 11]}
              cameraTarget={[0.8, 3.2, 0]}
              fov={40}
              maxDistance={20}
              minDistance={4}
            />
            <HoistScene motor={motor} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.weight}
            value={<InlineMath math={measure(CRATE_WEIGHT, "\\text{ N}", 0)} />}
          />
          <VisualFactTabular
            label={labels.height}
            value={<InlineMath math={measure(LIFT_HEIGHT, "\\text{ m}", 0)} />}
          />
          <VisualFactTabular
            label={labels.energy}
            value={<InlineMath math={measure(LIFT_ENERGY, "\\text{ J}", 0)} />}
          />
          <VisualFactTabular
            label={labels.time}
            value={
              <InlineMath math={measure(liftTime(motor), "\\text{ s}", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.speed}
            value={
              <InlineMath math={measure(liftSpeed(motor), "\\text{ m/s}", 2)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
