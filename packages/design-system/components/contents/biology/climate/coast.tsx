import { useFrame } from "@react-three/fiber";
import {
  floodedCount,
  floodLevel,
  outlookOf,
  RECORD_YEARS,
  recordRate,
  recordRise,
  retreatOf,
  type Scenario,
  ScenarioSchema,
  VILLAGE,
  waveAtShore,
} from "@repo/design-system/components/contents/biology/climate/sea";
import {
  Beach,
  House,
  Mangroves,
  Sea,
  SeaWall,
  TideGauge,
} from "@repo/design-system/components/contents/biology/climate/village";
import {
  useQuantity,
  useReading,
} from "@repo/design-system/components/contents/simulation/quantity";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Slider } from "@repo/design-system/components/ui/slider";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  useVisualScene,
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr, Schema } from "effect";
import { type ReactNode, Suspense, useRef, useState } from "react";
import type { Group } from "three";

/** A storm pushes the sea 1 m higher and drives waves 1 m high at the coast. */
const STORM = { surge: 1, wave: 1 } as const;

/** On a calm day the waves at the coast are 0.3 m high. */
const CALM_WAVE = 0.3;

/** The mangrove belt in front of the village is 100 m wide. */
const MANGROVE_WIDTH = 100;

/** The defences a card can switch on. */
const DefenceSchema = Schema.Literals(["wall", "mangrove", "storm"]);
type Defence = typeof DefenceSchema.Type;

/**
 * A coastal village on a beach that climbs 1 m every 20 m inland, at real
 * scale, with a tide gauge at today's high-tide line. `record` walks the
 * observed global rise since 1901; `scenario` raises the sea to an emission
 * pathway's 2100 median; `flood` lets the reader raise the sea and bring a
 * storm; `adapt` adds a sea wall and a mangrove belt against that storm.
 */
export function SeaLevelRiseLab({
  description,
  labels,
  mode,
  scenarios = ["ssp126", "ssp245", "ssp585"],
  title,
}: {
  readonly description: ReactNode;
  readonly labels: {
    readonly choose?: string;
    readonly defences?: Readonly<Partial<Record<Defence, ReactNode>>>;
    readonly flooded?: ReactNode;
    readonly level: ReactNode;
    readonly range?: ReactNode;
    readonly rate?: ReactNode;
    readonly retreat: ReactNode;
    readonly rise?: string;
    readonly scenarios?: Readonly<Partial<Record<Scenario, ReactNode>>>;
    readonly span?: ReactNode;
    readonly viewLabel: string;
    readonly warming?: ReactNode;
    readonly wave?: ReactNode;
    readonly year?: string;
  };
  readonly mode: "adapt" | "flood" | "record" | "scenario";
  readonly scenarios?: readonly Scenario[];
  readonly title: ReactNode;
}) {
  const [year, setYear] = useState<number>(RECORD_YEARS.last);
  const [scenario, setScenario] = useState<Scenario>(scenarios[0] ?? "ssp245");
  const [rise, setRise] = useState(0.5);
  const [defences, setDefences] = useState<readonly Defence[]>(mode === "adapt" ? ["storm"] : []);
  const quantity = useQuantity();
  const reading = useReading();
  const storm = mode === "adapt" || Arr.contains(defences, "storm");
  const mangrove = mode === "adapt" && Arr.contains(defences, "mangrove");
  const wall = mode === "adapt" && Arr.contains(defences, "wall");
  const outlook = outlookOf(scenario);
  const sea = seaRise(mode, year, outlook.rise, rise);
  const wave = waveAtShore(storm ? STORM.wave : CALM_WAVE, mangrove ? MANGROVE_WIDTH : 0);
  const level = mode === "record" || mode === "scenario" ? sea : floodLevel(sea, storm ? STORM.surge : 0, wave);
  const flooded = floodedCount(level, VILLAGE.floors, wall ? VILLAGE.wall : 0);
  const metres = "\\text{ m}";

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        {mode === "record" && (
          <Labeled label={labels.year} shown={String(Math.round(year))}>
            <Slider aria-label={labels.year} max={RECORD_YEARS.last} min={RECORD_YEARS.first} onValueChange={setYear} step={1} value={year} />
          </Labeled>
        )}
        {mode === "scenario" && labels.scenarios && (
          <ToggleGroup
            aria-label={labels.choose}
            onValueChange={(value: string) => {
              if (Schema.is(ScenarioSchema)(value)) {
                setScenario(value);
              }
            }}
            type="single"
            value={scenario}
            variant="outline"
          >
            {Arr.map(scenarios, (each) => (
              <ToggleGroupItem key={each} value={each}>
                {labels.scenarios?.[each]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
        {(mode === "flood" || mode === "adapt") && (
          <>
            <Labeled label={labels.rise} shown={`${reading(rise, 1)} m`}>
              <Slider aria-label={labels.rise} max={1} min={0} onValueChange={setRise} step={0.1} value={rise} />
            </Labeled>
            {labels.defences && (
              <ToggleGroup
                aria-label={labels.choose}
                onValueChange={(value: readonly string[]) =>
                  setDefences(Arr.filter(value, Schema.is(DefenceSchema)))
                }
                type="multiple"
                value={defences}
                variant="outline"
              >
                {Arr.map(mode === "adapt" ? (["wall", "mangrove"] as const) : (["storm"] as const), (each) => (
                  <ToggleGroupItem key={each} value={each}>
                    {labels.defences?.[each]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
          </>
        )}
      </VisualCardToolbar>

      <VisualCardBody aria-label={labels.viewLabel} className={threeSceneFrameVariants()} render={<section />}>
        <ScienceStage floor={0} reach={45} setting="field">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[78, 22, 42]}
              cameraTarget={[8, 0, 0]}
              fov={38}
              maxDistance={160}
              maxPolarAngle={1.45}
              minDistance={20}
            />
            <Beach />
            {Arr.map(VILLAGE.floors, (floor, index) => (
              <House index={index} key={floor} wet={level > floor && !(wall && level < VILLAGE.wall)} />
            ))}
            <TideGauge />
            {wall && <SeaWall />}
            {mangrove && <Mangroves />}
            <Water level={level} wave={wave} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular label={labels.level} value={<InlineMath math={quantity(level, metres, 2)} />} />
          {mode === "record" && (
            <>
              <VisualFactTabular label={labels.rate} value={<InlineMath math={quantity(recordRate(year) * 1000, "\\text{ mm}", 1)} />} />
              <VisualFactTabular label={labels.span} value={<InlineMath math={quantity(year - RECORD_YEARS.first, "", 0)} />} />
            </>
          )}
          {mode === "scenario" && (
            <>
              <VisualFactTabular label={labels.warming} value={<InlineMath math={quantity(outlook.warming, "\\,^\\circ\\text{C}", 1)} />} />
              <VisualFactTabular label={labels.range} value={<InlineMath math={`${quantity(outlook.low, "", 2)}\\text{ -- }${quantity(outlook.high, metres, 2)}`} />} />
            </>
          )}
          {(mode === "flood" || mode === "adapt") && (
            <>
              <VisualFactTabular label={labels.wave} value={<InlineMath math={quantity(wave, metres, 2)} />} />
              <VisualFactTabular label={labels.flooded} value={<InlineMath math={`${flooded}/${VILLAGE.floors.length}`} />} />
            </>
          )}
          <VisualFactTabular label={labels.retreat} value={<InlineMath math={quantity(retreatOf(sea, VILLAGE.slope), metres, 0)} />} />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** How far the sea has risen in each mode, in metres. */
function seaRise(
  mode: "adapt" | "flood" | "record" | "scenario",
  year: number,
  scenario: number,
  chosen: number
) {
  if (mode === "record") {
    return recordRise(year);
  }
  return mode === "scenario" ? scenario : chosen;
}

/** A slider with its name and its value above it. */
function Labeled({
  children,
  label,
  shown,
}: {
  readonly children: ReactNode;
  readonly label?: string | undefined;
  readonly shown: string;
}) {
  return (
    <div className="flex min-w-44 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span>{label}</span>
        <span className="tabular-nums">{shown}</span>
      </div>
      {children}
    </div>
  );
}

/**
 * The sea at `level`. Played, it eases toward its level and heaves by the
 * waves' height, so the reader sees how far a wave reaches up the beach.
 */
function Water({ level, wave }: { readonly level: number; readonly wave: number }) {
  const playing = useVisualScene((card) => card.playing, false);
  const surface = useRef<Group>(null);
  const clock = useRef(0);

  useFrame((_, delta) => {
    if (!(playing && surface.current)) {
      return;
    }
    clock.current += Math.min(delta, 0.1);
    surface.current.position.y = level + Math.sin(clock.current * 1.4) * (wave / 2);
  });

  return (
    <>
      <SimulationTicker running={playing} />
      <group position={[0, level, 0]} ref={surface}>
        <Sea level={0} />
      </group>
    </>
  );
}
