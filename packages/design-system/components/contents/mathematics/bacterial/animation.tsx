import {
  BacterialGenerations,
  BacterialSpeeds,
  BacterialTimeProvider,
} from "@repo/design-system/components/contents/mathematics/bacterial/controls";
import type { BacterialFormulaType } from "@repo/design-system/components/contents/mathematics/bacterial/growth";
import {
  BacterialGrowthFrameInputSchema,
  getBacterialGrowthFrame,
} from "@repo/design-system/components/contents/mathematics/bacterial/growth";
import { divisionCells } from "@repo/design-system/components/contents/mathematics/bacterial/layout";
import {
  NO_DIVISION,
  stepDivision,
} from "@repo/design-system/components/contents/mathematics/bacterial/sketch";
import type { BacteriaStore } from "@repo/design-system/components/contents/mathematics/bacterial/store";
import {
  createBacteriaStore,
  shownGeneration,
} from "@repo/design-system/components/contents/mathematics/bacterial/store";
import {
  fade,
  litBall,
  mix,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
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
import { getColor } from "@repo/design-system/lib/color";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import type { ReactNode } from "react";
import { createContext, useState } from "react";
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
    title?: NonNullable<ReactNode>;
    /** What the dish asks the reader to watch, under the title. */
    description?: NonNullable<ReactNode>;
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

/** Draws an illuminated microscope culture chamber with condenser glow, graticule ticks, and cover-slip rim. */
function drawMicroscopeStage(
  sketch: p5,
  width: number,
  height: number,
  accent: string
) {
  const cx = width / 2;
  const cy = height / 2;
  const span = Math.hypot(width, height) * 0.56;
  const stageEdge = mix(getColor("ZINC", 950), accent, 0.16);
  const agarCenter = mix(accent, getColor("WHITE"), 0.88);
  const agarMid = mix(accent, getColor("SLATE", 200), 0.72);
  const agarOuter = mix(accent, getColor("SLATE", 700), 0.52);
  const graticule = mix(accent, getColor("ZINC", 950), 0.7);

  sketch.background(stageEdge);

  // Full-field trans-illuminated condenser light through nutrient agar
  const context = sketch.drawingContext;
  if (context instanceof CanvasRenderingContext2D) {
    const condenser = context.createRadialGradient(
      cx - width * 0.06,
      cy - height * 0.08,
      Math.min(width, height) * 0.04,
      cx,
      cy,
      span
    );
    condenser.addColorStop(0, agarCenter);
    condenser.addColorStop(0.58, agarMid);
    condenser.addColorStop(1, agarOuter);
    context.fillStyle = condenser;
    context.fillRect(0, 0, width, height);
  } else {
    sketch.background(agarMid);
  }

  // Subtle etched microscopy ocular reticle (crosshair + concentric measurement rings)
  sketch.noFill();
  sketch.stroke(fade(graticule, 0.11));
  sketch.strokeWeight(1);
  const minorRadius = Math.min(width, height) * 0.34;
  sketch.circle(cx, cy, minorRadius * 2);
  sketch.circle(cx, cy, minorRadius * 3.1);
  sketch.line(cx - width * 0.44, cy, cx + width * 0.44, cy);
  sketch.line(cx, cy - height * 0.44, cx, cy + height * 0.44);

  // Micrometer scale ticks along the horizontal reticle
  const tickStep = Math.max(18, Math.round(width / 26));
  const halfTicks = Math.floor((width * 0.4) / tickStep);
  Arr.forEach(Arr.range(-halfTicks, halfTicks), (index) => {
    if (index === 0) {
      return;
    }
    const tx = cx + index * tickStep;
    const major = index % 5 === 0 ? 7 : 3.5;
    sketch.line(tx, cy - major, tx, cy + major);
  });

  // Beveled glass cover-slip frame + top-left specular sheen
  const inset = 6;
  sketch.stroke(fade(getColor("WHITE"), 0.55));
  sketch.strokeWeight(1.5);
  sketch.rect(inset, inset, width - inset * 2, height - inset * 2, 8);
  sketch.stroke(fade(graticule, 0.18));
  sketch.strokeWeight(1);
  sketch.rect(
    inset + 2,
    inset + 2,
    width - (inset + 2) * 2,
    height - (inset + 2) * 2,
    6
  );
  sketch.noStroke();
}

/** Draws one shaded bacterial cell with agar contact shadow, membrane halo, nucleoid, and wet specular gloss. */
function drawBacterium(
  sketch: p5,
  x: number,
  y: number,
  radius: number,
  color: string
) {
  const darkEdge = mix(color, getColor("BLACK"), 0.45);
  const deepCore = mix(color, getColor("ZINC", 950), 0.78);
  const brightCore = mix(color, getColor("WHITE"), 0.54);

  // Soft agar contact shadow offset toward bottom-right
  sketch.noStroke();
  withShadow(
    sketch,
    {
      blur: Math.max(4, radius * 0.28),
      color: fade(deepCore, 0.28),
      drop: Math.max(2, radius * 0.12),
    },
    () => {
      // 3D-shaded cytoplasmic body
      litBall(sketch, { x, y }, radius, {
        dark: darkEdge,
        light: brightCore,
      });
    }
  );

  // Outer translucent glycocalyx / capsule halo
  sketch.noFill();
  sketch.stroke(fade(brightCore, 0.42));
  sketch.strokeWeight(Math.max(1.2, radius * 0.1));
  sketch.circle(x, y, radius * 2.1);

  // Crisp outer plasma membrane rim
  sketch.stroke(fade(darkEdge, 0.68));
  sketch.strokeWeight(Math.max(0.75, radius * 0.06));
  sketch.circle(x, y, radius * 1.98);
  sketch.noStroke();

  // Internal nucleoid region, ribosome flecks & curved wet specular highlight
  if (radius >= 4) {
    sketch.fill(fade(darkEdge, 0.22));
    sketch.ellipse(
      x + radius * 0.08,
      y + radius * 0.06,
      radius * 0.86,
      radius * 0.66
    );
    sketch.fill(fade(brightCore, 0.28));
    sketch.circle(x + radius * 0.26, y - radius * 0.18, radius * 0.18);
    sketch.circle(x - radius * 0.16, y + radius * 0.3, radius * 0.14);
    sketch.fill(fade(getColor("WHITE"), 0.62));
    sketch.ellipse(
      x - radius * 0.3,
      y - radius * 0.32,
      radius * 0.42,
      radius * 0.28
    );
  }
}

/**
 * Draws dividing bacteria inside an illuminated microscope culture chamber.
 * Each frame moves the division on, asks the lesson for the next generation
 * once one ends, and draws shaded cells with membrane halos and optical depth.
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
    drawMicroscopeStage(sketch, sketch.width, sketch.height, frame.color);
    Arr.forEach(
      divisionCells(
        frame.current,
        frame.next,
        division.phase,
        sketch.width,
        sketch.height
      ),
      ({ radius, x, y }) => {
        drawBacterium(sketch, x, y, radius, frame.color);
      }
    );
    vignette(sketch, 0.16);
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
      {/* The two choices read as one control at the default size, so neither stands at a width of its own. */}
      <ButtonGroup>
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
      </ButtonGroup>
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
              {format.number(frame.bacteriaCount, "math")}
              <span className="sr-only"> {t("bacteria")}</span>
            </span>
          }
        />
        <VisualFact
          label={t("time")}
          value={`${format.number(generation * settings.timeInterval, "math")} ${settings.timeUnit}`}
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
    description: "Each generation, every cell divides in two.",
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
        <VisualCard
          onReset={() => {
            store.getState().pace(1);
          }}
          onStop={() => {
            store.getState().show(0, store.getState().view);
          }}
        >
          <VisualCardHeader
            description={labels.description}
            title={labels.title}
          />
          <BacteriaToolbar />
          <BacteriaDish />
          <VisualCardSceneActions />
          <BacteriaFacts />
        </VisualCard>
      </BacterialTimeProvider>
    </BacteriaContext>
  );
}
