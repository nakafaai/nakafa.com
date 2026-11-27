import { transformer } from "@repo/design-system/components/contents/physics/field/magnet";
import { TransformerScene } from "@repo/design-system/components/contents/physics/field/transformer/scene";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import type { ReactNode } from "react";
import { Suspense } from "react";

interface TransformerLabProps {
  description: NonNullable<ReactNode>;
  /** The transformer's efficiency, from 0 to 1. */
  efficiency: number;
  labels: {
    input: ReactNode;
    lost: ReactNode;
    primaryCurrent: ReactNode;
    ratio: ReactNode;
    viewLabel: string;
  };
  /** The power the load draws from the secondary, in watts. */
  outputPower: number;
  /** The primary voltage, in volts. */
  primaryVoltage: number;
  /** The secondary voltage, in volts. */
  secondaryVoltage: number;
  title: NonNullable<ReactNode>;
}

/**
 * A transformer on a laminated iron core lights a bulb from its secondary
 * coil. Its turns stand in the ratio of its voltages, and since it is not
 * ideal, the core and coils turn part of the input power into heat, so the
 * primary must take in more power than the bulb uses.
 */
export function TransformerLab({
  description,
  efficiency,
  labels,
  outputPower,
  primaryVoltage,
  secondaryVoltage,
  title,
}: TransformerLabProps) {
  const quantity = useQuantity();
  const coils = transformer({
    efficiency,
    output: outputPower,
    primary: primaryVoltage,
    secondary: secondaryVoltage,
  });

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={3.2} setting="lab">
          <Suspense fallback={null}>
            <TransformerScene
              efficiency={efficiency}
              output={outputPower}
              primary={primaryVoltage}
              ratio={coils.ratio}
              secondary={secondaryVoltage}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.ratio}
            value={<InlineMath math={`${quantity(coils.ratio, "", 1)}:1`} />}
          />
          <VisualFactTabular
            label={labels.input}
            value={<InlineMath math={quantity(coils.input, "\\text{ W}", 1)} />}
          />
          <VisualFactTabular
            label={labels.lost}
            value={<InlineMath math={quantity(coils.lost, "\\text{ W}", 1)} />}
          />
          <VisualFactTabular
            label={labels.primaryCurrent}
            value={
              <InlineMath
                math={quantity(coils.primaryCurrent, "\\text{ A}", 3)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
