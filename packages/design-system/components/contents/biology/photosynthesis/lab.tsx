import {
  farthestDistance,
  type Reading,
  relativeIntensity,
} from "@repo/design-system/components/contents/biology/photosynthesis/light";
import {
  PhotosynthesisCamera,
  PhotosynthesisScene,
} from "@repo/design-system/components/contents/biology/photosynthesis/scene";
import { toggleColumns } from "@repo/design-system/components/contents/simulation/columns";
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
import { Array as Arr } from "effect";
import { type ReactNode, Suspense, useState } from "react";

/**
 * Hydrilla in a boiling tube of water, standing in a water bath that keeps
 * its temperature steady, with a lamp on a metre rule. The cut stem gives
 * off bubbles of oxygen at the rate of each reading, in real time, so a
 * learner can count them against a clock. Moving the lamp closer brightens
 * the light on the plant with the inverse square of the distance;
 * sodium hydrogen carbonate in the water gives it more carbon dioxide.
 */
export function PhotosynthesisLab({
  description,
  labels,
  readings,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly bubbles: ReactNode;
    readonly carbon: ReactNode;
    readonly carbonSources: Readonly<{ added: ReactNode; none: ReactNode }>;
    readonly distance: ReactNode;
    readonly intensity: ReactNode;
    readonly reading: string;
    readonly view: string;
  };
  readonly readings: readonly [Reading, ...Reading[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [chosen, setChosen] = useState(0);
  const quantity = useQuantity();
  const reading = readings[chosen] ?? readings[0];
  const farthest = farthestDistance(readings);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      {readings.length > 1 && (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.reading}
            gridColumns={toggleColumns(readings.length)}
            onValueChange={(value: string) => {
              if (value !== "") {
                setChosen(Number(value));
              }
            }}
            type="single"
            value={String(chosen)}
            variant="outline"
          >
            {Arr.map(readings, (each, index) => (
              <ToggleGroupItem
                key={`${each.distance}-${each.bubbles}-${each.bicarbonate === true}`}
                value={String(index)}
              >
                <InlineMath
                  math={`${quantity(each.distance, "\\text{ cm}", 1)}${each.bicarbonate === true ? "+\\mathrm{NaHCO_3}" : ""}`}
                />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </VisualCardToolbar>
      )}

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={0.5} setting="lab">
          <Suspense fallback={null}>
            <PhotosynthesisCamera farthest={farthest} />
            <PhotosynthesisScene reading={reading} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.distance}
            value={
              <InlineMath
                math={`d = ${quantity(reading.distance, "\\text{ cm}", 1)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.intensity}
            value={
              <InlineMath
                math={`\\left(\\dfrac{${quantity(farthest, "", 1)}}{${quantity(reading.distance, "", 1)}}\\right)^2 = ${quantity(relativeIntensity(reading.distance, farthest), "", 2)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.bubbles}
            value={
              <InlineMath
                math={quantity(reading.bubbles, "\\text{ min}^{-1}", 1)}
              />
            }
          />
          <VisualFactTabular
            label={labels.carbon}
            value={
              reading.bicarbonate === true
                ? labels.carbonSources.added
                : labels.carbonSources.none
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
