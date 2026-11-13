import { WaveScene } from "@repo/design-system/components/contents/physics/renewable-energy/wave/scene";
import {
  SEA_STATES,
  type Sea,
  SeaSchema,
  wavelength,
  wavePower,
} from "@repo/design-system/components/contents/physics/renewable-energy/wave/swell";
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

interface WaveBuoyPowerLabProps {
  description: ReactNode;
  labels: {
    chooseSea: string;
    height: ReactNode;
    length: ReactNode;
    period: ReactNode;
    power: ReactNode;
    seas: Record<Sea, ReactNode>;
    viewLabel: string;
  };
  /** The sea state first shown. */
  sea?: Sea;
  title: ReactNode;
}

/**
 * A wave-energy buoy riding deep-water waves, drawn with the height stretched
 * four times. Each sea carries ρ g² H² T / (64π) watts
 * across every metre of crest: twice the wave height brings four times the
 * power, and the buoy's generator on the seabed turns part of it into
 * electricity.
 */
export function WaveBuoyPowerLab({
  description,
  labels,
  sea: initialSea = "moderate",
  title,
}: WaveBuoyPowerLabProps) {
  const [sea, setSea] = useState<Sea>(initialSea);
  const measure = useQuantity();
  const isSea = Schema.is(SeaSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseSea}
          gridColumns="3"
          onValueChange={(value) => {
            if (isSea(value)) {
              setSea(value);
            }
          }}
          type="single"
          value={sea}
          variant="outline"
        >
          {Arr.map(SeaSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              {labels.seas[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} frameloop="always" reach={40} setting="field">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[24, 7, 30]}
              cameraTarget={[4, 0, 0]}
              fov={36}
              maxDistance={90}
              minDistance={10}
            />
            <WaveScene sea={sea} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.height}
            value={
              <InlineMath
                math={measure(SEA_STATES[sea].height, "\\text{ m}", 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.period}
            value={
              <InlineMath
                math={measure(SEA_STATES[sea].period, "\\text{ s}", 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.length}
            value={
              <InlineMath math={measure(wavelength(sea), "\\text{ m}", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.power}
            value={
              <InlineMath
                math={measure(wavePower(sea) / 1000, "\\text{ kW/m}", 1)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
