import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  BlockScene,
  ENTRY,
  SHAPE,
} from "@repo/design-system/components/contents/physics/optics/block/scene";
import {
  criticalAngle,
  traceBlock,
} from "@repo/design-system/components/contents/physics/optics/ray";
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
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

interface GlassBlockLabProps {
  description: NonNullable<ReactNode>;
  /** The angle of incidence the ray starts at on the top face, in degrees. */
  incidence: number;
  /** The refractive index of the glass. */
  index: number;
  labels: {
    critical: ReactNode;
    incidence: ReactNode;
    incidenceName: string;
    next: ReactNode;
    outcome: ReactNode;
    reflected: ReactNode;
    refracted: ReactNode;
    refraction: ReactNode;
    viewLabel: string;
  };
  title: NonNullable<ReactNode>;
}

/**
 * A ray box on a felt baseboard aims a narrow beam at one long face of a
 * rectangular glass block, the face the lesson calls its top.
 * The beam refracts toward the normal, then meets the next face: below the
 * critical angle it leaves, past it it is totally reflected back into the
 * glass. Turn the ray box and watch the decision at that face change.
 */
export function GlassBlockLab({
  description,
  incidence: start,
  index,
  labels,
  title,
}: GlassBlockLabProps) {
  const quantity = useQuantity();
  const [incidence, setIncidence] = useState(start);
  const { hits, refraction } = traceBlock(
    { ...SHAPE, index },
    ENTRY,
    incidence
  );
  const first = Arr.head(hits);

  return (
    <VisualCard
      onReset={() => {
        setIncidence(start);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={<span>{labels.incidence}</span>}
          max={85}
          min={0}
          name={labels.incidenceName}
          onValueChange={setIncidence}
          readout={<InlineMath math={quantity(incidence, "^\\circ", 0)} />}
          step={1}
          value={incidence}
        />
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage
          floor={0}
          frameloop="always"
          ground="epoxy"
          reach={4.6}
          setting="lab"
        >
          <Suspense fallback={null}>
            <BlockScene incidence={incidence} index={index} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.refraction}
            value={<InlineMath math={quantity(refraction, "^\\circ", 1)} />}
          />
          <VisualFactTabular
            label={labels.next}
            value={
              <InlineMath
                math={quantity(
                  Option.match(first, {
                    onNone: () => 0,
                    onSome: (hit) => hit.incidence,
                  }),
                  "^\\circ",
                  1
                )}
              />
            }
          />
          <VisualFactTabular
            label={labels.critical}
            value={
              <InlineMath math={quantity(criticalAngle(index), "^\\circ", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.outcome}
            value={
              Option.exists(first, (hit) => hit.event === "reflected")
                ? labels.reflected
                : labels.refracted
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
