import {
  crowdOf,
  type Day,
  immuneShare,
  type Measures,
  nextInfected,
  outbreakOf,
  peakOf,
  type Route,
  reproductionOf,
  SQUARE,
  type Walker,
  walk,
} from "@repo/design-system/components/contents/biology/epidemic/spread";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Slider } from "@repo/design-system/components/ui/slider";
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
  VisualFactIndicator,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { P5Sketch } from "@repo/design-system/components/visual/sketch";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Option } from "effect";
import type p5 from "p5";
import { type ReactNode, useMemo, useState } from "react";

/** The outbreak the card follows, in days. */
const DAYS = 120;

/** Played, eight days pass each second. */
const DAYS_PER_SECOND = 8;

/** The people in the square. */
const PEOPLE = 160;

/** The measures a card can offer as sliders, in toolbar order. */
const MEASURES = ["masks", "washing", "vaccinated", "distancing"] as const;

/** What the sketch reads from the card on every frame. */
type Town = Readonly<{
  measures: Measures;
  outbreak: readonly Day[];
  report: (day: number) => void;
}>;

/**
 * A town square of 60 m by 40 m where people stroll past a fountain while a
 * virus spreads. The outbreak follows the SIR model day by day, and each new
 * case appears beside someone already infected. Sliders set the share of
 * people who wear masks, wash their hands, are vaccinated or stay home; the
 * footer reads the reproduction number, the peak, and the shares susceptible,
 * infected, recovered and immune on the day shown, each beside its colour.
 */
export function EpidemicSpreadLab({
  description,
  labels,
  measures,
  routes = ["air"],
  title,
}: {
  readonly description: ReactNode;
  readonly labels: {
    readonly chooseRoute?: string;
    readonly distancing?: string;
    readonly immune: ReactNode;
    readonly infected: ReactNode;
    readonly masks?: string;
    readonly peak: ReactNode;
    readonly recovered: ReactNode;
    readonly reproduction: ReactNode;
    readonly routes?: Readonly<{ air: ReactNode; touch: ReactNode }>;
    readonly susceptible: ReactNode;
    readonly vaccinated?: string;
    readonly viewLabel: string;
    readonly washing?: string;
  };
  readonly measures: readonly (typeof MEASURES)[number][];
  readonly routes?: readonly Route[];
  readonly title: ReactNode;
}) {
  const [values, setValues] = useState<Measures>({
    distancing: 0,
    masks: 0,
    vaccinated: 0,
    washing: 0,
  });
  const [route, setRoute] = useState<Route>(routes[0] ?? "air");
  const [day, setDay] = useState(DAYS);
  const quantity = useQuantity();
  const percent = (share: number) => (
    <InlineMath math={quantity(share * 100, "\\%", 0)} />
  );
  const outbreak = useMemo(
    () => outbreakOf(values, route, DAYS),
    [values, route]
  );
  const today = outbreak[Math.min(DAYS, Math.round(day))];
  const town = useMemo(
    () => ({ measures: values, outbreak, report: setDay }),
    [outbreak, values]
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      {(measures.length > 0 || routes.length > 1) && (
        <VisualCardToolbar>
          {routes.length > 1 && labels.routes && (
            <ToggleGroup
              aria-label={labels.chooseRoute}
              onValueChange={(value: string) =>
                setRoute(value === "touch" ? "touch" : "air")
              }
              type="single"
              value={route}
              variant="outline"
            >
              {Arr.map(routes, (each) => (
                <ToggleGroupItem key={each} value={each}>
                  {labels.routes?.[each]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
          {Arr.map(
            Arr.filter(MEASURES, (measure) => Arr.contains(measures, measure)),
            (measure) => (
              <div
                className="flex min-w-40 flex-1 flex-col gap-2"
                key={measure}
              >
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span>{labels[measure]}</span>
                  <span className="tabular-nums">
                    {Math.round(values[measure] * 100)}%
                  </span>
                </div>
                <Slider
                  aria-label={labels[measure]}
                  max={1}
                  min={0}
                  onValueChange={(value: number) =>
                    setValues((current) => ({ ...current, [measure]: value }))
                  }
                  step={0.05}
                  value={values[measure]}
                />
              </div>
            )
          )}
        </VisualCardToolbar>
      )}

      <VisualCardBody className="bg-card">
        <P5Sketch label={labels.viewLabel} program={townProgram} state={town} />
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.reproduction}
            value={
              <InlineMath
                math={quantity(reproductionOf(values, route), "", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.peak}
            value={
              <InlineMath math={quantity(peakOf(outbreak) * 100, "\\%", 0)} />
            }
          />
          <VisualFactIndicator
            indicatorColor={STATE_COLORS.susceptible}
            label={labels.susceptible}
            value={percent(today?.susceptible ?? 0)}
          />
          <VisualFactIndicator
            indicatorColor={STATE_COLORS.infected}
            label={labels.infected}
            value={percent(today?.infected ?? 0)}
          />
          <VisualFactIndicator
            indicatorColor={STATE_COLORS.recovered}
            label={labels.recovered}
            value={percent(
              Math.max(0, (today?.recovered ?? 0) - immuneShare(values))
            )}
          />
          <VisualFactIndicator
            indicatorColor={STATE_COLORS.immune}
            label={labels.immune}
            value={percent(immuneShare(values))}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** The four states a person can be in, each with its own mark colour. */
const STATE_COLORS = {
  immune: PLOT_COLORS.violet,
  infected: PLOT_COLORS.pink,
  recovered: PLOT_COLORS.teal,
  susceptible: PLOT_COLORS.slate,
} as const;

/**
 * The sketch: the square, its people and a graph of the outbreak under it.
 * The outbreak's curves say how many are infected each day; the sketch
 * infects the people nearest to a case until it matches them, and lets the
 * longest infected recover first.
 */
function townProgram(sketch: p5, read: () => Town) {
  let walkers: readonly Walker[] = [];
  let infected: readonly boolean[] = [];
  let recovered: readonly boolean[] = [];
  let immune: readonly boolean[] = [];
  let order: readonly number[] = [];
  let day = 0;
  let reported = -1;
  let shown: Town | undefined;

  const restart = (town: Town) => {
    walkers = crowdOf(PEOPLE, town.measures.distancing);
    const protectedCount = Math.round(immuneShare(town.measures) * PEOPLE);
    immune = Arr.map(walkers, (_, index) => index >= PEOPLE - protectedCount);
    const seed = Option.getOrElse(
      Arr.findFirstIndex(
        walkers,
        (walker, index) => !walker.home && immune[index] !== true
      ),
      () => 0
    );
    infected = Arr.map(walkers, (_, index) => index === seed);
    recovered = Arr.map(walkers, () => false);
    order = [seed];
    day = 0;
    shown = town;
  };

  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };

  sketch.draw = () => {
    const town = read();
    if (town !== shown) {
      restart(town);
    }
    const seconds = Math.min(0.1, sketch.deltaTime / 1000);
    day += seconds * DAYS_PER_SECOND;
    if (day > DAYS + 16) {
      restart(town);
    }
    const today = Math.min(DAYS, day);
    const sample = town.outbreak[Math.floor(today)] ?? town.outbreak[0];
    if (sample) {
      const startImmune = Arr.length(Arr.filter(immune, Boolean));
      const everTarget =
        Math.round((1 - sample.susceptible) * PEOPLE) - startImmune;
      const recoveredTarget =
        Math.round(sample.recovered * PEOPLE) - startImmune;
      const susceptible = Arr.map(
        walkers,
        (_, index) =>
          infected[index] !== true &&
          recovered[index] !== true &&
          immune[index] !== true
      );
      const fresh = nextInfected(
        walkers,
        infected,
        susceptible,
        everTarget - order.length
      );
      infected = Arr.map(
        infected,
        (value, index) => value || Arr.contains(fresh, index)
      );
      order = Arr.appendAll(order, fresh);
      const healed = Arr.take(order, Math.max(0, recoveredTarget));
      recovered = Arr.map(walkers, (_, index) => Arr.contains(healed, index));
      infected = Arr.map(
        infected,
        (value, index) => value && !recovered[index]
      );
    }
    walkers = Arr.map(walkers, (walker, index) =>
      walk(walker, seconds * 4, index + Math.floor(day * 10))
    );

    drawSquare(sketch);
    drawPeople(
      sketch,
      walkers,
      infected,
      recovered,
      immune,
      town.measures.masks
    );
    drawGraph(sketch, town, today);

    if (Math.floor(today) !== reported) {
      reported = Math.floor(today);
      town.report(reported);
    }
  };
}

/**
 * Where the square and the graph go: side by side on a wide card, the
 * square on the left filling the height; stacked on a narrow one, the square
 * over the graph. The square keeps its 60 m by 40 m shape either way.
 */
function layoutOf(sketch: p5) {
  const wide = sketch.width > sketch.height * 1.3;
  const plazaWidth = wide ? sketch.width * 0.64 : sketch.width;
  const plazaHeight = wide ? sketch.height : sketch.height * 0.72;
  return {
    graphBottom: wide ? sketch.height * 0.88 : sketch.height - 10,
    graphLeft: wide ? plazaWidth + 16 : 12,
    graphTop: wide ? sketch.height * 0.12 : sketch.height * 0.75,
    plazaHeight,
    plazaWidth,
  };
}

/** How the square's metres map onto its part of the canvas. */
function squareFrame(sketch: p5) {
  const { plazaHeight, plazaWidth } = layoutOf(sketch);
  const scale = Math.min(
    plazaWidth / (SQUARE.width + 6),
    plazaHeight / (SQUARE.depth + 6)
  );
  return {
    scale,
    x: (metres: number) => plazaWidth / 2 + metres * scale,
    y: (metres: number) => plazaHeight / 2 + metres * scale,
  };
}

/** Stone paving, a fountain in the middle and shade trees in the corners. */
function drawSquare(sketch: p5) {
  const frame = squareFrame(sketch);
  sketch.clear();
  sketch.noStroke();
  sketch.fill(MATERIAL.grass);
  const { plazaHeight, plazaWidth } = layoutOf(sketch);
  sketch.rect(0, 0, plazaWidth, plazaHeight);
  sketch.noStroke();
  sketch.fill(MATERIAL.pavement);
  sketch.rect(
    frame.x(-SQUARE.width / 2),
    frame.y(-SQUARE.depth / 2),
    SQUARE.width * frame.scale,
    SQUARE.depth * frame.scale,
    4
  );
  sketch.stroke(getColor("SLATE", 400));
  sketch.strokeWeight(0.6);
  Arr.forEach(Arr.range(-14, 14), (column) => {
    sketch.line(
      frame.x(column * 2),
      frame.y(-SQUARE.depth / 2),
      frame.x(column * 2),
      frame.y(SQUARE.depth / 2)
    );
  });
  Arr.forEach(Arr.range(-9, 9), (row) => {
    sketch.line(
      frame.x(-SQUARE.width / 2),
      frame.y(row * 2),
      frame.x(SQUARE.width / 2),
      frame.y(row * 2)
    );
  });
  sketch.noStroke();
  sketch.fill(MATERIAL.concrete);
  sketch.circle(frame.x(0), frame.y(0), 9 * frame.scale);
  sketch.fill(MATERIAL.seawater);
  sketch.circle(frame.x(0), frame.y(0), 7.4 * frame.scale);
  Arr.forEach(
    [
      [-26, -16],
      [26, -16],
      [-26, 16],
      [26, 16],
    ] as const,
    ([x, y]) => {
      sketch.fill(MATERIAL.foliageShade);
      sketch.circle(frame.x(x), frame.y(y), 7 * frame.scale);
      sketch.fill(MATERIAL.foliageLight);
      sketch.circle(
        frame.x(x) - frame.scale,
        frame.y(y) - frame.scale,
        4.6 * frame.scale
      );
    }
  );
}

/**
 * Everyone out in the square as a dot coloured by state, a vaccinated person
 * with a ring, and a mask as a pale band on the first `masks` share.
 */
function drawPeople(
  sketch: p5,
  walkers: readonly Walker[],
  infected: readonly boolean[],
  recovered: readonly boolean[],
  immune: readonly boolean[],
  masks: number
) {
  const frame = squareFrame(sketch);
  const size = Math.max(4, 1.1 * frame.scale);
  Arr.forEach(walkers, (walker, index) => {
    if (walker.home) {
      return;
    }
    const x = frame.x(walker.x);
    const y = frame.y(walker.y);
    const color =
      (infected[index] === true && STATE_COLORS.infected) ||
      (recovered[index] === true && STATE_COLORS.recovered) ||
      (immune[index] === true && STATE_COLORS.immune) ||
      STATE_COLORS.susceptible;
    sketch.noStroke();
    sketch.fill(color);
    sketch.circle(x, y, size);
    if (index < Math.round(masks * PEOPLE)) {
      sketch.fill(getColor("SLATE", 50));
      sketch.rect(x - size * 0.35, y + size * 0.05, size * 0.7, size * 0.22, 1);
    }
  });
}

/** The share infected, recovered and still susceptible over the days, under the square. */
function drawGraph(sketch: p5, town: Town, today: number) {
  const {
    graphBottom: bottom,
    graphLeft: left,
    graphTop: top,
  } = layoutOf(sketch);
  const right = sketch.width - 12;
  const x = (dayIndex: number) => left + ((right - left) * dayIndex) / DAYS;
  const y = (share: number) => bottom - (bottom - top) * share;
  const series = [
    ["susceptible", (each: Day) => each.susceptible],
    ["infected", (each: Day) => each.infected],
    ["recovered", (each: Day) => each.recovered],
  ] as const;
  sketch.noFill();
  sketch.strokeWeight(2);
  Arr.forEach(series, ([state, value]) => {
    sketch.stroke(STATE_COLORS[state]);
    sketch.beginShape();
    Arr.forEach(Arr.take(town.outbreak, Math.floor(today) + 1), (each) => {
      sketch.vertex(x(each.day), y(value(each)));
    });
    sketch.endShape();
  });
}
