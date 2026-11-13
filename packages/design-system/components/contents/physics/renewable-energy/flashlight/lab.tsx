import { mix } from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  BATTERY_ENERGY,
  type Bulb,
  BulbSchema,
  heatPower,
  INPUT_POWER,
  LIGHT_SHARE,
  lightPower,
  RUN_TIME,
} from "@repo/design-system/components/contents/physics/renewable-energy/flashlight/bulb";
import { FlashlightScene } from "@repo/design-system/components/contents/physics/renewable-energy/flashlight/scene";
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
import { getColor } from "@repo/design-system/lib/color";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import { type ReactNode, Suspense, useState } from "react";

/** The light and heat colors, shared by the scene and the facts. */
const LIGHT_COLOR = mix(PLOT_COLORS.amber, getColor("WHITE"), 0.55);

const HEAT_COLOR = PLOT_COLORS.pink;

interface FlashlightEfficiencyLabProps {
  /** The bulb in the flashlight first. */
  bulb?: Bulb;
  description: ReactNode;
  labels: {
    battery: ReactNode;
    bulbs: Record<Bulb, ReactNode>;
    chooseBulb: string;
    efficiency: ReactNode;
    heat: ReactNode;
    input: ReactNode;
    light: ReactNode;
    runTime: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * A flashlight in a dark room, its cells drawn in cutaway. The battery's
 * chemical energy becomes 1 W of electrical power, and the bulb turns it into
 * light and heat. Both bulbs empty the battery in the same 7.5 h, but the LED
 * puts eight times as much of it into light.
 */
export function FlashlightEfficiencyLab({
  bulb: initialBulb = "filament",
  description,
  labels,
  title,
}: FlashlightEfficiencyLabProps) {
  const [bulb, setBulb] = useState<Bulb>(initialBulb);
  const measure = useQuantity();
  const isBulb = Schema.is(BulbSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseBulb}
          gridColumns="2"
          onValueChange={(value) => {
            if (isBulb(value)) {
              setBulb(value);
            }
          }}
          type="single"
          value={bulb}
          variant="outline"
        >
          {Arr.map(BulbSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              {labels.bulbs[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} frameloop="always" reach={0.8} setting="studio">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[0.4, 0.45, 1.45]}
              cameraTarget={[0.42, 0.12, 0]}
              fov={40}
              maxDistance={2.4}
              minDistance={0.4}
            />
            <FlashlightScene bulb={bulb} heatColor={HEAT_COLOR} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.battery}
            value={
              <InlineMath math={measure(BATTERY_ENERGY, "\\text{ J}", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.input}
            value={<InlineMath math={measure(INPUT_POWER, "\\text{ W}", 0)} />}
          />
          <VisualFactIndicator
            indicatorColor={LIGHT_COLOR}
            label={labels.light}
            value={
              <InlineMath math={measure(lightPower(bulb), "\\text{ W}", 2)} />
            }
          />
          <VisualFactIndicator
            indicatorColor={HEAT_COLOR}
            label={labels.heat}
            value={
              <InlineMath math={measure(heatPower(bulb), "\\text{ W}", 2)} />
            }
          />
          <VisualFactTabular
            label={labels.efficiency}
            value={
              <InlineMath math={measure(LIGHT_SHARE[bulb] * 100, "\\%", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.runTime}
            value={
              <InlineMath math={measure(RUN_TIME / 3600, "\\text{ h}", 1)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
