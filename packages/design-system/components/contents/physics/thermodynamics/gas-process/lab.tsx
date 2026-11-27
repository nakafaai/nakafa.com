import { ProcessDiagram } from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/chart";
import { temperatureSpan } from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/cylinder";
import {
  axesFor,
  endStep,
  settleEnd,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/diagram";
import type {
  GasProcess,
  GasProcessSetup,
  GasStart,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/gas";
import {
  endState,
  energyOf,
  energyScale,
  MONATOMIC_GAMMA,
  rangeOf,
  reachableStates,
  startState,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/gas";
import {
  EnergyBars,
  ProcessLaw,
  StateFact,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/readout";
import { GasProcessScene } from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/scene";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Slider } from "@repo/design-system/components/ui/slider";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  useVisual,
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr, Option, Record as Rec } from "effect";
import type { ReactNode } from "react";
import { Suspense, useMemo, useState } from "react";
import { useFormatter } from "use-intl";

/** How many steps each axis of the diagram is marked in, about. */
const AXIS_STEPS = 5;

/** Four processes stand two by two on a phone, so each name keeps its width; two or three share one row in equal columns. */
function processColumns(count: number) {
  return count === 4 ? "4" : "2";
}

/** The slider that sets where the process ends; taking it stops a play, so the hand moves the gas. */
function EndSlider({
  label,
  onChange,
  setup,
  value,
}: {
  readonly label: string;
  readonly onChange: (value: number) => void;
  readonly setup: GasProcessSetup;
  readonly value: number;
}) {
  const { playing, togglePlaying } = useVisual((state) => ({
    playing: state.playing,
    togglePlaying: state.togglePlaying,
  }));
  const range = rangeOf(setup);
  return (
    <Slider
      aria-label={label}
      max={range.max}
      min={range.min}
      onValueChange={(next: number) => {
        if (playing) {
          togglePlaying();
        }
        onChange(settleEnd(range, next));
      }}
      step={endStep(range)}
      value={value}
    />
  );
}

/**
 * An ideal gas in a cylinder, taken through one of the four processes of
 * the first law, with its p-V diagram under the scene. The scene holds the
 * apparatus alone: the piston, the pressure gauge, the thermometer, the
 * colour of the gas and its molecules all follow the process. The learner
 * picks the process, then drags the end of its path on the diagram, or the
 * slider, and the end slides along the process's own curve. The band under
 * the path is the work W the gas does, and three bars give the heat Q into
 * the gas, W, and the change ΔU of its internal energy on one scale, so
 * ΔU = Q − W shows. What holds each process stands round the cylinder:
 * weights on the piston, pins through it, a water bath, or a foam jacket.
 * With `showValues`, the bars read their numbers in joules; without them,
 * only their signs.
 */
export function GasProcessLab({
  description,
  gamma = MONATOMIC_GAMMA,
  labels,
  moles,
  processes,
  showValues = false,
  start: given,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly gamma?: number;
  readonly labels: {
    readonly endPressure: string;
    readonly endState: ReactNode;
    readonly endVolume: string;
    readonly energy: string;
    readonly heat: ReactNode;
    readonly internal: ReactNode;
    readonly law: ReactNode;
    readonly pressureAxis: ReactNode;
    readonly process: string;
    readonly processes: Readonly<Record<GasProcess, string>>;
    readonly startState: ReactNode;
    readonly viewLabel: string;
    readonly volumeAxis: ReactNode;
    readonly work: ReactNode;
  };
  readonly moles: number;
  readonly processes: readonly [GasProcessSetup, ...GasProcessSetup[]];
  readonly showValues?: boolean;
  readonly start: GasStart;
  readonly title: NonNullable<ReactNode>;
}) {
  const format = useFormatter();
  const [chosen, setChosen] = useState<GasProcess>(processes[0].process);
  // How far along its process the gas is while the card plays, as the scene tells it.
  const [share, setShare] = useState(1);
  const [ends, setEnds] = useState(() =>
    Rec.fromEntries(
      Arr.map(processes, (setup) => [
        setup.process,
        settleEnd(rangeOf(setup), rangeOf(setup).end),
      ])
    )
  );
  const setup = Option.getOrElse(
    Arr.findFirst(processes, (each) => each.process === chosen),
    () => processes[0]
  );
  const first = useMemo(() => startState(moles, given), [given, moles]);
  const reach = useMemo(
    () => reachableStates(processes, first, gamma),
    [first, gamma, processes]
  );
  const axes = useMemo(() => axesFor(reach, AXIS_STEPS), [reach]);
  const span = useMemo(() => temperatureSpan(reach), [reach]);
  const scale = useMemo(
    () => energyScale(processes, first, gamma),
    [first, gamma, processes]
  );
  const value = ends[setup.process] ?? rangeOf(setup).end;
  const last = endState(setup.process, first, value, gamma);
  const energy = energyOf(setup.process, first, last, gamma);
  const kelvin = (temperature: number) =>
    `${format.number(temperature, "math", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} K`;
  const record = (next: number) =>
    setEnds((shown) => ({ ...shown, [setup.process]: next }));

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        {processes.length > 1 ? (
          <ToggleGroup
            aria-label={labels.process}
            gridColumns={processColumns(processes.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(processes, (each) => each.process === next),
                (each) => setChosen(each.process)
              );
            }}
            type="single"
            value={chosen}
            variant="outline"
          >
            {Arr.map(processes, (each) => (
              <ToggleGroupItem key={each.process} value={each.process}>
                {labels.processes[each.process]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}
        <div className="flex h-9 w-full items-center px-1">
          <EndSlider
            key={setup.process}
            label={
              setup.process === "isochoric"
                ? labels.endPressure
                : labels.endVolume
            }
            onChange={record}
            setup={setup}
            value={value}
          />
        </div>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={0.6} setting="lab">
          <Suspense fallback={null}>
            <GasProcessScene
              end={last}
              fullPressure={axes.pressure.maximum}
              gamma={gamma}
              kelvin={kelvin}
              largest={axes.volume.maximum}
              onShare={setShare}
              process={setup.process}
              scale={scale}
              span={span}
              start={first}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <ProcessDiagram
          axes={axes}
          end={last}
          gamma={gamma}
          names={{ pressure: labels.pressureAxis, volume: labels.volumeAxis }}
          onEnd={record}
          process={setup.process}
          range={rangeOf(setup)}
          share={share}
          start={first}
        />
        <VisualCardFacts>
          <StateFact index={1} label={labels.startState} state={first} />
          <StateFact index={2} label={labels.endState} state={last} />
        </VisualCardFacts>
        <EnergyBars
          energy={energy}
          labels={labels}
          scale={scale}
          showValues={showValues}
        />
        <VisualCardFacts>
          <ProcessLaw
            energy={energy}
            label={labels.law}
            process={setup.process}
            scale={scale}
            showValues={showValues}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
