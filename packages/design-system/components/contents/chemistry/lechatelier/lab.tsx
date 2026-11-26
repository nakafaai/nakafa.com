import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type {
  Disturbance,
  KcState,
  LeChatelierSystem,
  ShiftDirection,
} from "@repo/design-system/components/contents/chemistry/lechatelier/model";
import { evaluateLeChatelier } from "@repo/design-system/components/contents/chemistry/lechatelier/model";
import { LeChatelierScene } from "@repo/design-system/components/contents/chemistry/lechatelier/scene";
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
import {
  VisualFact,
  VisualFactIndicator,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { EQUILIBRIUM_COLORS } from "@repo/design-system/lib/material/equilibrium";
import { Array as Arr, Match, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

function controlHeadingFor(
  disturbance: Disturbance,
  labels: {
    readonly catalyst: string;
    readonly concentration: string;
    readonly pressure: string;
    readonly temperature: string;
  }
) {
  return Match.value(disturbance).pipe(
    Match.when("pressure", () => labels.pressure),
    Match.when("temperature", () => labels.temperature),
    Match.when("concentration", () => labels.concentration),
    Match.when("catalyst", () => labels.catalyst),
    Match.exhaustive
  );
}

export function LeChatelierLab({
  description,
  disturbances,
  labels,
  systems,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly disturbances: readonly [Disturbance, ...Disturbance[]];
  readonly labels: {
    readonly catalyst: string;
    readonly concentration: string;
    readonly disturbance: string;
    readonly disturbances: Readonly<Partial<Record<Disturbance, string>>>;
    readonly kcChange?: ReactNode;
    readonly kcStates: Readonly<Record<KcState, string>>;
    readonly pressure: string;
    readonly shift?: ReactNode;
    readonly shifts: Readonly<Record<ShiftDirection, ReactNode>>;
    readonly system: string;
    readonly systems: Readonly<
      Partial<
        Record<
          LeChatelierSystem,
          {
            readonly enthalpy: string;
            readonly equation: ReactNode;
            readonly name: string;
          }
        >
      >
    >;
    readonly temperature: string;
    readonly view: string;
    readonly yield: ReactNode;
  };
  readonly systems: readonly [LeChatelierSystem, ...LeChatelierSystem[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [system, setSystem] = useState<LeChatelierSystem>(systems[0]);
  const [disturbance, setDisturbance] = useState<Disturbance>(disturbances[0]);
  const [intensity, setIntensity] = useState(0.5);
  const quantity = useQuantity();

  const response = evaluateLeChatelier(system, disturbance, intensity);
  const systemWords = labels.systems[system];
  const controlHeading = controlHeadingFor(disturbance, labels);
  const shiftIndicator = Match.value(response.shift).pipe(
    Match.when("forward", () => EQUILIBRIUM_COLORS.forwardArrow),
    Match.when("none", () => EQUILIBRIUM_COLORS.balancedGlow),
    Match.when("reverse", () => EQUILIBRIUM_COLORS.reverseArrow),
    Match.exhaustive
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSystem(systems[0]);
          setDisturbance(disturbances[0]);
          setIntensity(0.5);
        }}
      />

      <VisualCardToolbar>
        {systems.length > 1 ? (
          <ToggleGroup
            aria-label={labels.system}
            gridColumns={toggleColumns(systems.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(systems, (item) => item === next),
                setSystem
              );
            }}
            type="single"
            value={system}
            variant="outline"
          >
            {Arr.map(systems, (item) => (
              <ToggleGroupItem key={item} value={item}>
                {labels.systems[item]?.name ?? item}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        {disturbances.length > 1 ? (
          <ToggleGroup
            aria-label={labels.disturbance}
            gridColumns={toggleColumns(disturbances.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(disturbances, (item) => item === next),
                (picked) => {
                  setDisturbance(picked);
                  setIntensity(picked === "catalyst" ? 1 : 0.5);
                }
              );
            }}
            type="single"
            value={disturbance}
            variant="outline"
          >
            {Arr.map(disturbances, (item) => (
              <ToggleGroupItem key={item} value={item}>
                {labels.disturbances[item] ?? item}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={controlHeading}
          label={controlHeading}
          max={disturbance === "catalyst" ? 1 : 100}
          min={disturbance === "catalyst" ? 0 : -100}
          onValueChange={(next) =>
            setIntensity(disturbance === "catalyst" ? next : next / 100)
          }
          readout={
            disturbance === "catalyst"
              ? `${intensity > 0 ? "ON" : "OFF"}`
              : `${Math.round(intensity * 100)}%`
          }
          step={disturbance === "catalyst" ? 1 : 10}
          value={
            disturbance === "catalyst"
              ? Math.round(intensity)
              : Math.round(intensity * 100)
          }
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={1.1} setting="lab">
          <Suspense fallback={null}>
            <LeChatelierScene
              catalystLabel={labels.catalyst}
              disturbance={disturbance}
              enthalpyLabel={systemWords?.enthalpy ?? ""}
              intensity={intensity}
              system={system}
              yieldPercent={response.yieldPercent}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {systemWords === undefined ? null : (
            <VisualFact label={labels.system} value={systemWords.equation} />
          )}
          <VisualFactTabular
            label={labels.yield}
            value={
              <InlineMath math={quantity(response.yieldPercent, "\\%", 0)} />
            }
          />
          {labels.shift === undefined ? null : (
            <VisualFactIndicator
              indicatorColor={shiftIndicator}
              label={labels.shift}
              value={labels.shifts[response.shift]}
            />
          )}
          {labels.kcChange === undefined ? null : (
            <VisualFact
              label={labels.kcChange}
              value={labels.kcStates[response.kcState]}
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
