import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type {
  DynamicSystem,
  EquilibriumState,
} from "@repo/design-system/components/contents/chemistry/equilibrium/model";
import {
  evaluateDynamic,
  MAX_SIMULATION_TIME,
} from "@repo/design-system/components/contents/chemistry/equilibrium/model";
import { DynamicEquilibriumScene } from "@repo/design-system/components/contents/chemistry/equilibrium/scene";
import { RateConvergenceTrace } from "@repo/design-system/components/contents/chemistry/equilibrium/trace";
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
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function DynamicEquilibriumLab({
  description,
  forwardRate: forwardRange,
  initialReactant: initialRange,
  labels,
  reverseRate: reverseRange,
  systems,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly forwardRate: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly initialReactant: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly labels: {
    readonly equilibrium?: ReactNode;
    readonly forwardRate: string;
    readonly initial: string;
    readonly rateForward: ReactNode;
    readonly rateReverse: ReactNode;
    readonly reverseRate: string;
    readonly state: ReactNode;
    readonly states: Readonly<Record<EquilibriumState, string>>;
    readonly system: string;
    readonly systems: Readonly<
      Partial<
        Record<
          DynamicSystem,
          {
            readonly equation: ReactNode;
            readonly name: string;
            readonly product: string;
            readonly reactant: string;
          }
        >
      >
    >;
    readonly view: string;
  };
  readonly reverseRate: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly systems: readonly [DynamicSystem, ...DynamicSystem[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [system, setSystem] = useState<DynamicSystem>(systems[0]);
  const [kf, setKf] = useState(forwardRange.value);
  const [kr, setKr] = useState(reverseRange.value);
  const [initial, setInitial] = useState(initialRange.value);
  const [elapsed, setElapsed] = useState(MAX_SIMULATION_TIME * 0.45);
  const quantity = useQuantity();

  const snapshot = evaluateDynamic(initial, kf, kr, elapsed);
  const systemWords = labels.systems[system];
  const productShare =
    initial > 0 ? snapshot.productConcentration / initial : 0;

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSystem(systems[0]);
          setKf(forwardRange.value);
          setKr(reverseRange.value);
          setInitial(initialRange.value);
          setElapsed(MAX_SIMULATION_TIME * 0.45);
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

        <VisualSlider
          heading={labels.forwardRate}
          label={labels.forwardRate}
          max={forwardRange.max}
          min={forwardRange.min}
          onValueChange={setKf}
          readout={<InlineMath math={quantity(kf, "\\text{ s}^{-1}", 2)} />}
          step={0.05}
          value={kf}
        />
        <VisualSlider
          heading={labels.reverseRate}
          label={labels.reverseRate}
          max={reverseRange.max}
          min={reverseRange.min}
          onValueChange={setKr}
          readout={<InlineMath math={quantity(kr, "\\text{ s}^{-1}", 2)} />}
          step={0.05}
          value={kr}
        />
        <VisualSlider
          heading={labels.initial}
          label={labels.initial}
          max={initialRange.max}
          min={initialRange.min}
          onValueChange={setInitial}
          readout={<InlineMath math={quantity(initial, "\\text{ M}", 2)} />}
          step={0.05}
          value={initial}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.3} setting="lab">
          <Suspense fallback={null}>
            <DynamicEquilibriumScene
              balanced={snapshot.state === "balanced"}
              elapsed={elapsed}
              forwardRate={snapshot.forwardRate}
              onElapsed={setElapsed}
              productLabel={systemWords?.product ?? "B"}
              productShare={productShare}
              reactantLabel={systemWords?.reactant ?? "A"}
              reverseRate={snapshot.reverseRate}
              system={system}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <RateConvergenceTrace
          elapsed={elapsed}
          forwardLabel={labels.rateForward}
          initialReactant={initial}
          kf={kf}
          kr={kr}
          reverseLabel={labels.rateReverse}
        />
        <VisualCardFacts>
          {systemWords === undefined ? null : (
            <VisualFact label={labels.system} value={systemWords.equation} />
          )}
          <VisualFactIndicator
            indicatorColor={EQUILIBRIUM_COLORS.forwardArrow}
            label={labels.rateForward}
            value={
              <InlineMath
                math={quantity(snapshot.forwardRate, "\\text{ M s}^{-1}", 2)}
              />
            }
          />
          <VisualFactIndicator
            indicatorColor={EQUILIBRIUM_COLORS.reverseArrow}
            label={labels.rateReverse}
            value={
              <InlineMath
                math={quantity(snapshot.reverseRate, "\\text{ M s}^{-1}", 2)}
              />
            }
          />
          <VisualFactIndicator
            indicatorColor={
              snapshot.state === "balanced"
                ? EQUILIBRIUM_COLORS.balancedGlow
                : EQUILIBRIUM_COLORS.qcMarker
            }
            label={labels.state}
            value={labels.states[snapshot.state]}
          />
          {labels.equilibrium === undefined ? null : (
            <VisualFactTabular
              label={labels.equilibrium}
              value={
                <InlineMath math={quantity(snapshot.equilibriumRatio, "", 2)} />
              }
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
