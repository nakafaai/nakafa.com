import {
  bend,
  gravitySplit,
  growth,
  lightSplit,
  type Split,
  type TropismSetup,
} from "@repo/design-system/components/contents/biology/tropism/auxin";
import {
  GravityScene,
  LightScene,
} from "@repo/design-system/components/contents/biology/tropism/scene";
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

/** How long the run lasts, in hours. */
const HOURS = 48;

/**
 * Seedlings that grow towards light or against gravity, each treated as the
 * lesson names. The tip makes auxin, the stimulus sorts it to one side, and
 * it travels down to where the cells elongate: in a shoot more auxin makes a
 * side grow faster, so the shoot curves away from it; in a root it slows a
 * side, so the root curves towards it. Cutting the tip, capping it or
 * blocking one side with mica changes where the auxin can go.
 */
export function TropismLab({
  description,
  labels,
  setup,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly bend: ReactNode;
    readonly directions: Readonly<{
      away: ReactNode;
      straight: ReactNode;
      toward: ReactNode;
    }>;
    readonly far: ReactNode;
    readonly growth: ReactNode;
    readonly hours: string;
    readonly near: ReactNode;
    readonly root: ReactNode;
    readonly seedling: string;
    readonly view: string;
  };
  readonly setup: TropismSetup;
  readonly title: NonNullable<ReactNode>;
}) {
  const [chosen, setChosen] = useState(0);
  const [elapsed, setElapsed] = useState(HOURS);
  const quantity = useQuantity();
  const progress = elapsed / HOURS;
  const shoot =
    setup.stimulus === "light"
      ? lightSplit((setup.seedlings[chosen] ?? setup.seedlings[0]).treatment)
      : gravitySplit(
          (setup.seedlings[chosen] ?? setup.seedlings[0]).treatment,
          "shoot"
        );
  const root =
    setup.stimulus === "gravity"
      ? gravitySplit(
          (setup.seedlings[chosen] ?? setup.seedlings[0]).treatment,
          "root"
        )
      : undefined;

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.seedling}
          onValueChange={(value: string) => {
            if (value !== "") {
              setChosen(Number(value));
            }
          }}
          type="single"
          value={String(chosen)}
          variant="outline"
        >
          {Arr.map(setup.seedlings, (each, index) => (
            <ToggleGroupItem key={each.name} value={String(index)}>
              {each.name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.hours}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={quantity(elapsed, "\\text{ h}", 0)} />
            </span>
          </div>
          <HandSlider
            label={labels.hours}
            max={HOURS}
            onChange={setElapsed}
            step={1}
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
            {setup.stimulus === "light" ? (
              <LightScene
                chosen={chosen}
                elapsed={elapsed}
                hours={HOURS}
                onElapsed={setElapsed}
                seedlings={setup.seedlings}
              />
            ) : (
              <GravityScene
                chosen={chosen}
                elapsed={elapsed}
                hours={HOURS}
                onElapsed={setElapsed}
                seedlings={setup.seedlings}
              />
            )}
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.far}
            value={<InlineMath math={quantity(shoot.far * 100, "\\%", 0)} />}
          />
          <VisualFactTabular
            label={labels.near}
            value={<InlineMath math={quantity(shoot.near * 100, "\\%", 0)} />}
          />
          <VisualFactTabular
            label={labels.bend}
            value={
              <Turn
                directions={labels.directions}
                organ="shoot"
                progress={progress}
                split={shoot}
              />
            }
          />
          {root === undefined ? (
            <VisualFactTabular
              label={labels.growth}
              value={
                <InlineMath
                  math={quantity(growth(shoot, progress) * 100, "\\%", 0)}
                />
              }
            />
          ) : (
            <VisualFactTabular
              label={labels.root}
              value={
                <Turn
                  directions={labels.directions}
                  organ="root"
                  progress={progress}
                  split={root}
                />
              }
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** How far an organ has curved, in degrees, and which way: towards the stimulus, away from it, or not at all. */
function Turn({
  directions,
  organ,
  progress,
  split,
}: {
  readonly directions: Readonly<{
    away: ReactNode;
    straight: ReactNode;
    toward: ReactNode;
  }>;
  readonly organ: "root" | "shoot";
  readonly progress: number;
  readonly split: Split;
}) {
  const quantity = useQuantity();
  const degrees = (bend(split, organ, progress) * 180) / Math.PI;
  if (Math.abs(degrees) < 0.5) {
    return directions.straight;
  }
  return (
    <>
      <InlineMath math={quantity(Math.abs(degrees), "^\\circ", 0)} />{" "}
      {degrees > 0 ? directions.toward : directions.away}
    </>
  );
}
