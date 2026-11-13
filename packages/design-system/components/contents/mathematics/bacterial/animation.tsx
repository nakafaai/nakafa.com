import {
  BacterialGenerations,
  BacterialSpeeds,
  BacterialTimeProvider,
} from "@repo/design-system/components/contents/mathematics/bacterial/controls";
import {
  type BacterialFormulaType,
  BacterialGrowthFrameInputSchema,
  getBacterialGrowthFrame,
} from "@repo/design-system/components/contents/mathematics/bacterial/growth";
import { divisionCells } from "@repo/design-system/components/contents/mathematics/bacterial/layout";
import {
  NO_DIVISION,
  stepDivision,
} from "@repo/design-system/components/contents/mathematics/bacterial/sketch";
import {
  type BacteriaStore,
  createBacteriaStore,
  shownGeneration,
} from "@repo/design-system/components/contents/mathematics/bacterial/store";
import { MATH_NUMBER_OPTIONS } from "@repo/design-system/components/contents/mathematics/number";
import {
  useVisualScene,
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { P5Sketch } from "@repo/design-system/components/visual/sketch";
import { useRequired } from "@repo/design-system/hooks/required";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import { createContext, type ReactNode, useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { useStore } from "zustand";

/** How long one generation lasts at normal speed, in milliseconds. */
const GENERATION_MILLISECONDS = 1600;

interface BacterialGrowthProps {
  /** The type of formula to use. @default "geometric" */
  formulaType?: BacterialFormulaType;
  /** The initial count of bacteria. @default 1 */
  initialCount?: number;
  /** The labels to use for the animation. */
  labels?: {
    title?: ReactNode;
    bacterial?: string;
  };
  /** The maximum number of generations to display. @default 6 */
  maxGenerations?: number;
  /** The ratio of bacterial growth. @default 2 */
  ratio?: number;
  /** The time interval in hours. @default 1 */
  timeInterval?: number;
  /** The time unit label (hours, minutes, etc.). @default "h" */
  timeUnit?: string;
}

/**
 * What the bacteria sketch reads on every frame: the cells now and in the next
 * generation, how long one generation lasts, the color they are drawn in, and
 * how to move the lesson to the next generation once a division ends.
 */
interface BacteriaFrame {
  readonly advance: () => void;
  readonly color: string;
  readonly current: number;
  readonly generation: number;
  readonly interval: number;
  readonly maxGenerations: number;
  readonly next: number;
}

/**
 * Draws dividing bacteria. Each frame moves the dish's division on, asks the
 * lesson for the next generation once one ends, and draws the cells of that
 * moment; a paused card shows the generation the learner chose.
 */
function bacteriaProgram(sketch: p5, read: () => BacteriaFrame) {
  let division = NO_DIVISION;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const frame = read();
    const step = stepDivision(division, {
      elapsed: sketch.deltaTime,
      generation: frame.generation,
      interval: frame.interval,
      maxGenerations: frame.maxGenerations,
      playing: sketch.isLooping(),
    });
    division = step.division;
    if (step.ended) {
      frame.advance();
    }
    sketch.clear();
    sketch.fill(frame.color);
    Arr.forEach(
      divisionCells(
        frame.current,
        frame.next,
        division.phase,
        sketch.width,
        sketch.height
      ),
      ({ radius, x, y }) => {
        sketch.circle(x, y, radius * 2);
      }
    );
  };
}

/** One growth card's settings, its labels, and the store of what it shows. */
const BacteriaContext = createContext<{
  readonly bacterial: string;
  readonly formulaType: BacterialFormulaType;
  readonly initialCount: number;
  readonly maxGenerations: number;
  readonly ratio: number;
  readonly store: BacteriaStore;
  readonly timeInterval: number;
  readonly timeUnit: string;
} | null>(null);

/** Reads the surrounding growth card's settings and store. */
function useBacteria() {
  return useRequired(BacteriaContext, "useBacteria");
}

/** The generation the card shows now, and the counts of that generation and the next. */
function useGrowth() {
  const settings = useBacteria();
  const view = useVisualScene((card) => card.view, 0);
  const generation = useStore(settings.store, (state) =>
    shownGeneration(state, view)
  );
  const frameAt = (at: number) =>
    getBacterialGrowthFrame(
      Schema.decodeSync(BacterialGrowthFrameInputSchema)({
        formulaType: settings.formulaType,
        generation: at,
        initialCount: settings.initialCount,
        maxGenerations: settings.maxGenerations,
        ratio: settings.ratio,
      })
    );
  const frame = frameAt(generation);
  const next = frameAt(Math.min(generation + 1, settings.maxGenerations));
  return { frame, generation, next, settings, view };
}

/** The speed and the generation a learner may pick, above the dish. */
function BacteriaToolbar() {
  const { generation, settings, view } = useGrowth();
  const speed = useStore(settings.store, (state) => state.speed);
  return (
    <VisualCardToolbar>
      <BacterialSpeeds
        onSpeedChange={(next) => settings.store.getState().pace(next)}
        speed={speed}
      />
      <BacterialGenerations
        generation={generation}
        maxGenerations={settings.maxGenerations}
        onGenerationChange={(next) =>
          settings.store.getState().show(next, view)
        }
      />
    </VisualCardToolbar>
  );
}

/** The dish: a p5 sketch of the cells growing and dividing. */
function BacteriaDish() {
  const { frame, generation, next, settings, view } = useGrowth();
  const speed = useStore(settings.store, (state) => state.speed);
  return (
    <VisualCardBody
      className="p-(--card-spacing)"
      data-bacteria-count={frame.bacteriaCount}
      data-visible-bacteria-count={frame.bacteriaIds.length}
    >
      <P5Sketch
        label={`${frame.bacteriaCount} ${settings.bacterial}`}
        program={bacteriaProgram}
        state={{
          advance: () => settings.store.getState().show(generation + 1, view),
          color: PLOT_COLORS.teal,
          current: frame.bacteriaIds.length,
          generation,
          interval: GENERATION_MILLISECONDS / speed,
          maxGenerations: settings.maxGenerations,
          next: next.bacteriaIds.length,
        }}
      />
    </VisualCardBody>
  );
}

/** The count and the time of the generation the dish shows. */
function BacteriaFacts() {
  const t = useTranslations("Common");
  const format = useFormatter();
  const { frame, generation, settings } = useGrowth();
  return (
    <VisualCardFooter>
      <VisualCardFacts>
        <VisualFact
          label={t("bacteria")}
          value={
            // aria-atomic makes a screen reader announce the count with its
            // subject, which is visually hidden because the label already shows it.
            <span aria-atomic="true" aria-live="polite">
              {format.number(frame.bacteriaCount, MATH_NUMBER_OPTIONS)}
              <span className="sr-only"> {t("bacteria")}</span>
            </span>
          }
        />
        <VisualFact
          label={t("time")}
          value={`${format.number(generation * settings.timeInterval, MATH_NUMBER_OPTIONS)} ${settings.timeUnit}`}
        />
      </VisualCardFacts>
    </VisualCardFooter>
  );
}

/**
 * Renders a bacterial-growth sketch for exponential-growth lessons: the cells
 * of a dish grow and divide once each generation in p5, played and paused with
 * the card's own play button, with the count and the time in its footer.
 */
export function BacterialGrowth({
  ratio = 2,
  initialCount = 1,
  maxGenerations = 6,
  formulaType = "geometric",
  timeInterval = 1,
  timeUnit = "h",
  labels = {
    title: "Bacterial Growth",
    bacterial: "Bacterial",
  },
}: BacterialGrowthProps) {
  const [store] = useState(createBacteriaStore);
  const time = { timeInterval, timeUnit };
  return (
    <BacteriaContext
      value={{
        bacterial: labels.bacterial ?? "",
        formulaType,
        initialCount,
        maxGenerations,
        ratio,
        store,
        timeInterval,
        timeUnit,
      }}
    >
      <BacterialTimeProvider time={time}>
        <VisualCard>
          <VisualCardHeader title={labels.title} />
          <BacteriaToolbar />
          <BacteriaDish />
          <VisualCardSceneActions />
          <BacteriaFacts />
        </VisualCard>
      </BacterialTimeProvider>
    </BacteriaContext>
  );
}
