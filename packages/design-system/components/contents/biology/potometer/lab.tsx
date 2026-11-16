import { PotometerScene } from "@repo/design-system/components/contents/biology/potometer/scene";
import {
  boreArea,
  bubbleTravel,
  type Shoot,
  uptakeAfter,
} from "@repo/design-system/components/contents/biology/potometer/uptake";
import { HandSlider } from "@repo/design-system/components/contents/chemistry/slider";
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
 * A bubble potometer at real size: a leafy shoot sealed into a water-filled
 * tube that runs into a capillary over a rule, its far end dipped in a
 * beaker. As the shoot takes up water, an air bubble in the capillary creeps
 * towards it; the water taken up is the cylinder the bubble moved along,
 * V = πr²l. Shoots whose leaves carry petroleum jelly on some surfaces take up
 * less, because the jelly seals the stomata there.
 */
export function PotometerLab({
  description,
  labels,
  minutes,
  radius,
  shoots,
  title,
}: {
  readonly description: ReactNode;
  readonly labels: {
    readonly distance: ReactNode;
    readonly rate: ReactNode;
    readonly shoot: string;
    readonly time: string;
    readonly view: string;
    readonly volume: ReactNode;
  };
  readonly minutes: number;
  readonly radius: number;
  readonly shoots: readonly [Shoot, ...Shoot[]];
  readonly title: ReactNode;
}) {
  const [chosen, setChosen] = useState(0);
  const [elapsed, setElapsed] = useState(minutes);
  const quantity = useQuantity();
  const shoot = shoots[chosen] ?? shoots[0];
  const travel = bubbleTravel(shoot.rate, radius, elapsed);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        {shoots.length > 1 && (
          <ToggleGroup
            aria-label={labels.shoot}
            onValueChange={(value: string) => {
              if (value !== "") {
                setChosen(Number(value));
              }
            }}
            type="single"
            value={String(chosen)}
            variant="outline"
          >
            {Arr.map(shoots, (each, index) => (
              <ToggleGroupItem key={each.name} value={String(index)}>
                {each.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.time}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={quantity(elapsed, "\\text{ min}", 1)} />
            </span>
          </div>
          <HandSlider
            label={labels.time}
            max={minutes}
            onChange={setElapsed}
            step={minutes / 50}
            value={elapsed}
          />
        </div>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={0.45} setting="lab">
          <Suspense fallback={null}>
            <PotometerScene
              elapsed={elapsed}
              minutes={minutes}
              onElapsed={setElapsed}
              radius={radius}
              shoot={shoot}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.time}
            value={
              <InlineMath
                math={`t = ${quantity(elapsed, "\\text{ min}", 1)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.distance}
            value={
              <InlineMath math={`l = ${quantity(travel, "\\text{ cm}", 2)}`} />
            }
          />
          <VisualFactTabular
            label={labels.volume}
            value={
              <InlineMath
                math={`V = \\pi r^2 l = ${quantity(boreArea(radius) * travel, "\\text{ cm}^3", 4)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.rate}
            value={
              <InlineMath
                math={`${quantity(uptakeAfter(shoot.rate, 1), "\\text{ cm}^3\\text{ min}^{-1}", 4)}`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
