import {
  electricOutput,
  FUELS,
  type Fuel,
  FuelSchema,
  fuelPerHour,
  HEAT_INPUT,
  idealEfficiency,
  wasteHeat,
} from "@repo/design-system/components/contents/physics/renewable-energy/steam/cycle";
import { SteamScene } from "@repo/design-system/components/contents/physics/renewable-energy/steam/scene";
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
import {
  VisualFactIndicator,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import { type ReactNode, Suspense, useState } from "react";

/** The colors of the heat in, the electricity out and the heat the condenser hands on. */
const FLOW_COLORS = {
  electric: PLOT_COLORS.orange,
  heat: PLOT_COLORS.amber,
  waste: PLOT_COLORS.pink,
} as const;

interface SteamPlantCycleLabProps {
  description: ReactNode;
  /** The fuel that heats the boiler first. */
  fuel?: Fuel;
  labels: {
    chooseFuel: string;
    electric: ReactNode;
    fuelUse: ReactNode;
    fuels: Record<Fuel, ReactNode>;
    heat: ReactNode;
    ideal: ReactNode;
    steam: ReactNode;
    viewLabel: string;
    waste: ReactNode;
  };
  title: ReactNode;
}

/**
 * A steam power plant fed 1000 MW of heat by coal, gas or uranium. The fuel
 * only changes how the heat is made; from the boiler on, the steam drives
 * the same turbine and generator, and the condenser hands most of the heat to
 * the cooling tower. Uranium's fission needs under a kilogram of fuel an hour
 * where coal needs 150 tonnes.
 */
export function SteamPlantCycleLab({
  description,
  fuel: initialFuel = "coal",
  labels,
  title,
}: SteamPlantCycleLabProps) {
  const [fuel, setFuel] = useState<Fuel>(initialFuel);
  const measure = useQuantity();
  const isFuel = Schema.is(FuelSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseFuel}
          gridColumns="3"
          onValueChange={(value) => {
            if (isFuel(value)) {
              setFuel(value);
            }
          }}
          type="single"
          value={fuel}
          variant="outline"
        >
          {Arr.map(FuelSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              {labels.fuels[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} frameloop="always" reach={12} setting="field">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[6, 12, 30]}
              cameraTarget={[0.5, 3, 0]}
              fov={38}
              maxDistance={50}
              minDistance={8}
            />
            <SteamScene colors={FLOW_COLORS} fuel={fuel} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={FLOW_COLORS.heat}
            label={labels.heat}
            value={
              <InlineMath math={measure(HEAT_INPUT / 1e6, "\\text{ MW}", 0)} />
            }
          />
          <VisualFactIndicator
            indicatorColor={FLOW_COLORS.electric}
            label={labels.electric}
            value={
              <InlineMath
                math={measure(electricOutput(fuel) / 1e6, "\\text{ MW}", 0)}
              />
            }
          />
          <VisualFactIndicator
            indicatorColor={FLOW_COLORS.waste}
            label={labels.waste}
            value={
              <InlineMath
                math={measure(wasteHeat(fuel) / 1e6, "\\text{ MW}", 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.steam}
            value={
              <InlineMath
                math={measure(FUELS[fuel].steam, "^\\circ\\text{C}", 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.ideal}
            value={
              <InlineMath
                math={measure(idealEfficiency(fuel) * 100, "\\%", 1)}
              />
            }
          />
          <VisualFactTabular
            label={labels.fuelUse}
            value={
              <InlineMath
                math={measure(
                  fuelPerHour(fuel),
                  "\\text{ kg}",
                  fuelPerHour(fuel) < 10 ? 2 : 0
                )}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
