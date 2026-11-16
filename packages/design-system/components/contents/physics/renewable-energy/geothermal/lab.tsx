import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  electricPower,
  heatRate,
  idealEfficiency,
  plantEfficiency,
  RESERVOIR,
} from "@repo/design-system/components/contents/physics/renewable-energy/geothermal/loop";
import { GeothermalScene } from "@repo/design-system/components/contents/physics/renewable-energy/geothermal/scene";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
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
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { type ReactNode, Suspense, useState } from "react";

interface GeothermalLoopLabProps {
  description: ReactNode;
  labels: {
    electric: ReactNode;
    heat: ReactNode;
    ideal: ReactNode;
    real: ReactNode;
    reservoirControl: string;
    viewLabel: string;
  };
  /** The reservoir's temperature at first, in degrees Celsius. */
  reservoir?: number;
  title: ReactNode;
}

/**
 * A geothermal plant in cross-section: hot water rises up the production
 * well, gives its heat to the plant, and goes back down the injection well at
 * 70 °C. A hotter reservoir gives more heat each second and lets the heat
 * engine convert a larger share of it, so the electricity climbs steeply.
 */
export function GeothermalLoopLab({
  description,
  labels,
  reservoir: initialReservoir = 200,
  title,
}: GeothermalLoopLabProps) {
  const [reservoir, setReservoir] = useState(initialReservoir);
  const measure = useQuantity();

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={labels.reservoirControl}
          max={RESERVOIR.max}
          min={RESERVOIR.min}
          name={labels.reservoirControl}
          onValueChange={setReservoir}
          readout={
            <InlineMath math={measure(reservoir, "^\\circ\\text{C}", 0)} />
          }
          step={RESERVOIR.step}
          value={reservoir}
        />
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} frameloop="always" reach={9} setting="field">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[10, 4, 18]}
              cameraTarget={[0, -2.2, 0]}
              fov={38}
              maxDistance={34}
              minDistance={6}
            />
            <GeothermalScene
              colors={{
                cool: PLOT_COLORS.teal,
                hot: PLOT_COLORS.orange,
                spark: PLOT_COLORS.amber,
              }}
              reservoir={reservoir}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.heat}
            value={
              <InlineMath
                math={measure(heatRate(reservoir) / 1e6, "\\text{ MW}", 1)}
              />
            }
          />
          <VisualFactTabular
            label={labels.ideal}
            value={
              <InlineMath
                math={measure(idealEfficiency(reservoir) * 100, "\\%", 1)}
              />
            }
          />
          <VisualFactTabular
            label={labels.real}
            value={
              <InlineMath
                math={measure(plantEfficiency(reservoir) * 100, "\\%", 1)}
              />
            }
          />
          <VisualFactTabular
            label={labels.electric}
            value={
              <InlineMath
                math={measure(electricPower(reservoir) / 1e6, "\\text{ MW}", 1)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
