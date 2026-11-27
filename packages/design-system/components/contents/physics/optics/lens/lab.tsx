import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { LensScene } from "@repo/design-system/components/contents/physics/optics/lens/scene";
import { thinLens } from "@repo/design-system/components/contents/physics/optics/ray";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
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
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

interface ConvexLensLabProps {
  description: NonNullable<ReactNode>;
  /** The focal length of the lens, in centimetres. */
  focal: number;
  labels: {
    distance: ReactNode;
    distanceName: string;
    image: ReactNode;
    magnification: ReactNode;
    nature: ReactNode;
    noImage: ReactNode;
    presets: string;
    real: ReactNode;
    viewLabel: string;
    virtual: ReactNode;
  };
  /** The object distance the lab starts at, in centimetres. */
  object: number;
  /** Object distances, in centimetres, that the toolbar offers one tap away. */
  presets?: readonly number[];
  title: NonNullable<ReactNode>;
}

/**
 * A lit arrow in front of a convex lens on a real optical bench. Three
 * principal rays from its tip find the image: one parallel to the axis bends
 * through the far focal point, one through the centre goes straight on, and
 * one through the near focal point leaves parallel. Slide the object across
 * the focal point and watch the real, inverted image turn into a virtual,
 * upright one behind the lens.
 */
export function ConvexLensLab({
  description,
  focal,
  labels,
  object: start,
  presets = [],
  title,
}: ConvexLensLabProps) {
  const quantity = useQuantity();
  const [object, setObject] = useState(start);
  const image = thinLens(focal, object);

  return (
    <VisualCard
      onReset={() => {
        setObject(start);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={<span>{labels.distance}</span>}
          max={Math.ceil(focal * 4)}
          min={Math.max(1, Math.round(focal * 0.2))}
          name={labels.distanceName}
          onValueChange={setObject}
          readout={<InlineMath math={quantity(object, "\\text{ cm}", 0)} />}
          step={1}
          value={object}
        />
        {Arr.isReadonlyArrayNonEmpty(presets) ? (
          <ToggleGroup
            aria-label={labels.presets}
            onValueChange={(value) => setObject(Number(value))}
            type="single"
            value={String(object)}
            variant="outline"
          >
            {Arr.map(presets, (preset) => (
              <ToggleGroupItem key={preset} value={String(preset)}>
                <InlineMath math={`u=${quantity(preset, "\\text{ cm}", 0)}`} />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} frameloop="always" reach={4} setting="lab">
          <Suspense fallback={null}>
            <LensScene focal={focal} object={object} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.image}
            value={Option.match(image, {
              onNone: () => labels.noImage,
              onSome: (found) => (
                <InlineMath
                  math={`v=${quantity(found.distance, "\\text{ cm}", 1)}`}
                />
              ),
            })}
          />
          <VisualFactTabular
            label={labels.magnification}
            value={Option.match(image, {
              onNone: () => labels.noImage,
              onSome: (found) => (
                <InlineMath
                  math={quantity(Math.abs(found.magnification), "\\times", 2)}
                />
              ),
            })}
          />
          <VisualFactTabular
            label={labels.nature}
            value={Option.match(image, {
              onNone: () => labels.noImage,
              onSome: (found) => (found.real ? labels.real : labels.virtual),
            })}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
