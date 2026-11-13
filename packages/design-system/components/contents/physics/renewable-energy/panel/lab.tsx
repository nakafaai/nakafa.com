import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  cellEfficiency,
  cellTemperature,
  IRRADIANCE,
  panelBalance,
} from "@repo/design-system/components/contents/physics/renewable-energy/panel/balance";
import { PanelScene } from "@repo/design-system/components/contents/physics/renewable-energy/panel/scene";
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
import {
  VisualFactIndicator,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { getColor } from "@repo/design-system/lib/color";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { type ReactNode, Suspense, useState } from "react";

/** The color of each share of the sunlight, shared by the scene and the facts. */
const SHARE_COLORS = {
  electric: PLOT_COLORS.orange,
  heat: PLOT_COLORS.pink,
  input: PLOT_COLORS.amber,
  reflected: getColor("SLATE", 300),
} as const;

interface SolarPanelHeatLabProps {
  description: ReactNode;
  /** The sunlight on the panel at first, in watts per square metre. */
  irradiance?: number;
  labels: {
    efficiency: ReactNode;
    electric: ReactNode;
    heat: ReactNode;
    input: ReactNode;
    irradianceControl: string;
    reflected: ReactNode;
    temperature: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * A 1.6 m² solar panel on a roof. The sunlight on it splits into a thin
 * reflection, electricity, and heat, and the three always add back to the
 * input. Stronger sun heats the cells, so the panel turns a slightly smaller
 * share into electricity.
 */
export function SolarPanelHeatLab({
  description,
  irradiance: initialIrradiance = 1000,
  labels,
  title,
}: SolarPanelHeatLabProps) {
  const [irradiance, setIrradiance] = useState(initialIrradiance);
  const measure = useQuantity();
  const balance = panelBalance(irradiance);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={labels.irradianceControl}
          max={IRRADIANCE.max}
          min={IRRADIANCE.min}
          name={labels.irradianceControl}
          onValueChange={setIrradiance}
          readout={
            <InlineMath math={measure(irradiance, "\\text{ W/m}^2", 0)} />
          }
          step={IRRADIANCE.step}
          value={irradiance}
        />
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} frameloop="always" reach={7} setting="field">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[6.5, 5.5, 9.5]}
              cameraTarget={[-0.8, 2.8, 0]}
              fov={36}
              maxDistance={22}
              minDistance={4}
            />
            <PanelScene colors={SHARE_COLORS} irradiance={irradiance} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={SHARE_COLORS.input}
            label={labels.input}
            value={
              <InlineMath math={measure(balance.input, "\\text{ W}", 0)} />
            }
          />
          <VisualFactIndicator
            indicatorColor={SHARE_COLORS.electric}
            label={labels.electric}
            value={
              <InlineMath math={measure(balance.electric, "\\text{ W}", 0)} />
            }
          />
          <VisualFactIndicator
            indicatorColor={SHARE_COLORS.reflected}
            label={labels.reflected}
            value={
              <InlineMath math={measure(balance.reflected, "\\text{ W}", 0)} />
            }
          />
          <VisualFactIndicator
            indicatorColor={SHARE_COLORS.heat}
            label={labels.heat}
            value={<InlineMath math={measure(balance.heat, "\\text{ W}", 0)} />}
          />
          <VisualFactTabular
            label={labels.temperature}
            value={
              <InlineMath
                math={measure(
                  cellTemperature(irradiance),
                  "^\\circ\\text{C}",
                  1
                )}
              />
            }
          />
          <VisualFactTabular
            label={labels.efficiency}
            value={
              <InlineMath
                math={measure(cellEfficiency(irradiance) * 100, "\\%", 1)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
