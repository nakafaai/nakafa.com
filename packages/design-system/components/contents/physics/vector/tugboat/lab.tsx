import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { TugboatScene } from "@repo/design-system/components/contents/physics/vector/tugboat/scene";
import {
  TugsSchema,
  towResultant,
} from "@repo/design-system/components/contents/physics/vector/tugboat/tow";
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
import { Schema } from "effect";
import { type ReactNode, Suspense, useMemo, useState } from "react";

interface TugboatResultantLabProps {
  /** The angle between the cables the card starts at, in degrees. */
  between: number;
  description: ReactNode;
  /** The pull of the first tug, in kN. */
  first: number;
  labels: {
    between: ReactNode;
    betweenName: string;
    fromFirst: ReactNode;
    fromLine: ReactNode;
    resultant: ReactNode;
    viewLabel: string;
  };
  /** The pull of the second tug, in kN. */
  second: number;
  title: ReactNode;
}

/**
 * Two harbour tugs tow a bulk carrier, their cables opening at an angle.
 * The learner opens or closes the cables: the two pulls span a
 * parallelogram whose diagonal is the resultant, its size by the cosine
 * rule and its direction by the sine rule.
 */
export function TugboatResultantLab({
  between: start,
  description,
  first,
  labels,
  second,
  title,
}: TugboatResultantLabProps) {
  const quantity = useQuantity();
  const [between, setBetween] = useState(start);
  const tugs = useMemo(
    () => Schema.decodeUnknownSync(TugsSchema)({ first, second }),
    [first, second]
  );
  const resultant = towResultant(tugs, between);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={labels.between}
          max={150}
          min={0}
          name={labels.betweenName}
          onValueChange={setBetween}
          readout={<InlineMath math={quantity(between, "^\\circ", 0)} />}
          step={1}
          value={between}
        />
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={-0.05} reach={9} setting="sky">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[3, 12, 10]}
              cameraTarget={[7, 0.6, 0]}
              fov={40}
              maxDistance={30}
              minDistance={5}
            />
            <TugboatScene between={between} tugs={tugs} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.resultant}
            value={
              <InlineMath math={quantity(resultant.size, "\\text{ kN}", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.fromFirst}
            value={
              <InlineMath math={quantity(resultant.fromFirst, "^\\circ", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.fromLine}
            value={
              <InlineMath math={quantity(resultant.fromLine, "^\\circ", 1)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
