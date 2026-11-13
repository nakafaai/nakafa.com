import {
  fade,
  gradientRect,
  litBall,
  mix,
  spotlight,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  INPUT_ENERGY,
  type Plant,
  PlantSchema,
  plantFlow,
  usefulEnergy,
} from "@repo/design-system/components/contents/physics/renewable-energy/flow/stages";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
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
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** The color of the energy entering each plant, the band that carries it. */
const PLANT_COLORS = {
  biogas: PLOT_COLORS.violet,
  geothermal: PLOT_COLORS.orange,
  hydro: PLOT_COLORS.teal,
  solar: PLOT_COLORS.amber,
  wind: mix(PLOT_COLORS.teal, getColor("SLATE", 300), 0.4),
} as const satisfies Record<Plant, string>;

/** The color of the energy handed to the surroundings. */
const LOSS_COLOR = PLOT_COLORS.pink;

/** What the sketch reads on every frame: the plant whose chain is drawn. */
interface FlowFrame {
  readonly plant: Plant;
}

/** Smooths a share from 0 to 1 so a band leaves and lands level. */
function ease(share: number) {
  return share * share * (3 - 2 * share);
}

/** A band of energy bending from one height to another, as thick as the joules it carries. */
function paintBend(
  sketch: p5,
  from: { x: number; top: number },
  to: { x: number; top: number },
  thick: number,
  color: string
) {
  sketch.fill(color);
  sketch.beginShape();
  for (let step = 0; step <= 20; step += 1) {
    const share = step / 20;
    sketch.vertex(
      from.x + (to.x - from.x) * share,
      from.top + (to.top - from.top) * ease(share)
    );
  }
  for (let step = 20; step >= 0; step -= 1) {
    const share = step / 20;
    sketch.vertex(
      from.x + (to.x - from.x) * share,
      from.top + thick + (to.top - from.top) * ease(share)
    );
  }
  sketch.endShape(sketch.CLOSE);
}

/**
 * Draws the chain as a flow chart in light: the source's band enters on the
 * left, each machine passes on part of it, and every loss bends down into a
 * glowing pool of heat, sound and vibration.
 */
function flowProgram(sketch: p5, read: () => FlowFrame) {
  let time = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { plant } = read();
    time += sketch.isLooping() ? Math.min(sketch.deltaTime / 1000, 0.1) : 0;
    const { height, width } = sketch;
    gradientRect(sketch, { height, width, x: 0, y: 0 }, [
      [0, mix(getColor("SLATE", 800), getColor("ZINC", 950), 0.4)],
      [1, getColor("ZINC", 950)],
    ]);
    spotlight(sketch, { x: width * 0.45, y: height * 0.35 }, width * 0.6, {
      color: getColor("SLATE", 400),
      strength: 0.18,
    });
    const pool = height * 0.9;
    gradientRect(sketch, { height: height - pool, width, x: 0, y: pool }, [
      [0, fade(LOSS_COLOR, 0.45)],
      [1, fade(LOSS_COLOR, 0.1)],
    ]);
    const top = height * 0.16;
    const scale = (height * 0.42) / INPUT_ENERGY;
    const [, stages] = plantFlow(plant);
    const start = width * 0.12;
    const end = width * 0.9;
    const gap = (end - start) / (stages.length + 1);
    const color = PLANT_COLORS[plant];
    litBall(
      sketch,
      { x: start - width * 0.04, y: top + (INPUT_ENERGY * scale) / 2 },
      height * 0.06,
      {
        dark: mix(color, getColor("BLACK"), 0.4),
        light: mix(color, getColor("WHITE"), 0.6),
      }
    );
    Arr.forEach(stages, (stage, index) => {
      const x = start + gap * (index + 1);
      gradientRect(
        sketch,
        {
          height: stage.entering * scale,
          width: x - (start + gap * index),
          x: start + gap * index,
          y: top,
        },
        [
          [0, mix(color, getColor("WHITE"), 0.25)],
          [1, color],
        ]
      );
      paintBend(
        sketch,
        { top: top + stage.kept * scale, x },
        { top: pool - stage.lost * scale * 0.5, x: x + gap * 0.7 },
        stage.lost * scale,
        fade(LOSS_COLOR, 0.75)
      );
      withShadow(
        sketch,
        { blur: 14, color: fade(getColor("BLACK"), 0.7), drop: 5 },
        () => {
          gradientRect(
            sketch,
            {
              height: stage.entering * scale + 16,
              width: gap * 0.16,
              x: x - gap * 0.08,
              y: top - 8,
            },
            [
              [0, getColor("SLATE", 400)],
              [1, getColor("SLATE", 700)],
            ]
          );
        }
      );
    });
    const last = start + gap * stages.length;
    const useful = usefulEnergy(plant);
    gradientRect(
      sketch,
      { height: useful * scale, width: end - last, x: last, y: top },
      [
        [0, mix(PLOT_COLORS.orange, getColor("WHITE"), 0.3)],
        [1, PLOT_COLORS.orange],
      ]
    );
    const bands = Arr.prepend(
      Arr.map(stages, (stage) => stage.kept),
      INPUT_ENERGY
    );
    sketch.fill(fade(getColor("WHITE"), 0.8));
    for (let spark = 0; spark < 14; spark += 1) {
      const along = (spark / 14 + time * 0.12) % 1;
      const x = start + (end - start) * along;
      const band = Arr.getUnsafe(
        bands,
        Math.min(Math.floor((x - start) / gap), stages.length)
      );
      sketch.circle(x, top + (((spark * 37) % 100) / 100) * band * scale, 3);
    }
    vignette(sketch, 0.35);
  };
}

interface EnergyFlowLossLabProps {
  description: ReactNode;
  labels: {
    choosePlant: string;
    efficiency: ReactNode;
    input: ReactNode;
    lost: ReactNode;
    plants: Record<Plant, ReactNode>;
    useful: ReactNode;
    viewLabel: string;
  };
  /** The plant whose chain is drawn first. */
  plant?: Plant;
  title: ReactNode;
}

/**
 * 100 J entering five kinds of power plant, drawn as a band of light that
 * every machine thins out. Each loss bends down into the surroundings, the
 * band that reaches the end is the useful electricity, and together they
 * always make the 100 J that went in.
 */
export function EnergyFlowLossLab({
  description,
  labels,
  plant: initialPlant = "solar",
  title,
}: EnergyFlowLossLabProps) {
  const [plant, setPlant] = useState<Plant>(initialPlant);
  const measure = useQuantity();
  const useful = usefulEnergy(plant);
  const isPlant = Schema.is(PlantSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.choosePlant}
          gridColumns="auto"
          onValueChange={(value) => {
            if (isPlant(value)) {
              setPlant(value);
            }
          }}
          type="single"
          value={plant}
          variant="outline"
        >
          {Arr.map(PlantSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              {labels.plants[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={flowProgram}
          state={{ plant }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={PLANT_COLORS[plant]}
            label={labels.input}
            value={<InlineMath math={measure(INPUT_ENERGY, "\\text{ J}", 0)} />}
          />
          <VisualFactIndicator
            indicatorColor={PLOT_COLORS.orange}
            label={labels.useful}
            value={<InlineMath math={measure(useful, "\\text{ J}", 2)} />}
          />
          <VisualFactIndicator
            indicatorColor={LOSS_COLOR}
            label={labels.lost}
            value={
              <InlineMath
                math={measure(INPUT_ENERGY - useful, "\\text{ J}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.efficiency}
            value={
              <InlineMath
                math={measure((useful / INPUT_ENERGY) * 100, "\\%", 1)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
