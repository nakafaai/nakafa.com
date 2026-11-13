import {
  coverOf,
  growOf,
  lengthOf,
  type Segment,
  sporesOf,
  TEMPEH,
} from "@repo/design-system/components/contents/biology/hyphae/growth";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Slider } from "@repo/design-system/components/ui/slider";
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
import { P5Sketch } from "@repo/design-system/components/visual/sketch";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import type p5 from "p5";
import { type ReactNode, useMemo, useState } from "react";

/** Growth is worked out a quarter of an hour at a time. */
const STEP_HOURS = 0.25;

/** Spores sown on the tray. */
const SPORES = 14;

/** Played, the 36 hours pass in 18 seconds. */
const HOURS_PER_SECOND = 2;

/** The squares the tray is split into to measure how much the mould covers. */
const COVER_CELLS = 24;

/** One quarter-hour of growth: the hyphae laid so far and the tips growing. */
type Stage = Readonly<{
  hours: number;
  segments: readonly Segment[];
  tips: number;
}>;

/** What the sketch reads from the card on every frame. */
type Tray = Readonly<{
  hours: number;
  report: (hours: number) => void;
  stages: readonly Stage[];
}>;

/**
 * Tempeh in the making, seen from above: cooked soybean halves sown with
 * Rhizopus spores at 30 °C. Each spore grows a hypha whose tip moves on and
 * branches, the threads spread between the beans and digest them, and by
 * about a day and a half a white mycelium binds the beans into one cake. The
 * reader scrubs the hours; the footer reads the hyphae's total length, the
 * tips and the share of the tray covered.
 */
export function HyphaeDecayLab({
  description,
  labels,
  title,
}: {
  readonly description: ReactNode;
  readonly labels: {
    readonly cover: ReactNode;
    readonly hours: string;
    readonly length: ReactNode;
    readonly tips: ReactNode;
    readonly time: ReactNode;
    readonly viewLabel: string;
  };
  readonly title: ReactNode;
}) {
  const [hours, setHours] = useState<number>(TEMPEH.hours);
  const quantity = useQuantity();
  const stages = useMemo(() => growthOf(), []);
  const tray = useMemo(
    () => ({ hours, report: setHours, stages }),
    [hours, stages]
  );
  const stage =
    stages[Math.min(stages.length - 1, Math.round(hours / STEP_HOURS))];
  const segments = stage?.segments ?? [];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.hours}</span>
            <span className="tabular-nums">
              {Math.round(hours)}/{TEMPEH.hours}
            </span>
          </div>
          <Slider
            aria-label={labels.hours}
            max={TEMPEH.hours}
            min={0}
            onValueChange={setHours}
            step={STEP_HOURS}
            value={hours}
          />
        </div>
      </VisualCardToolbar>

      <VisualCardBody className="bg-card">
        <P5Sketch label={labels.viewLabel} program={trayProgram} state={tray} />
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.time}
            value={<InlineMath math={quantity(hours, "\\text{ h}", 0)} />}
          />
          <VisualFactTabular
            label={labels.length}
            value={
              <InlineMath
                math={quantity(lengthOf(segments) / 10, "\\text{ cm}", 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.tips}
            value={<InlineMath math={quantity(stage?.tips ?? 0, "", 0)} />}
          />
          <VisualFactTabular
            label={labels.cover}
            value={
              <InlineMath
                math={quantity(coverOf(segments, COVER_CELLS) * 100, "\\%", 0)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** The whole 36 hours of growth, a quarter-hour at a time, worked out once. */
function growthOf(): readonly Stage[] {
  const steps = Math.round(TEMPEH.hours / STEP_HOURS);
  return Arr.scan(
    Arr.range(1, steps),
    {
      hours: 0,
      live: sporesOf(SPORES),
      segments: Arr.empty<Segment>(),
      tips: SPORES,
    },
    (stage, step) => {
      const grown = growOf(stage.live, STEP_HOURS, step);
      return {
        hours: step * STEP_HOURS,
        live: grown.tips,
        segments: Arr.appendAll(stage.segments, grown.segments),
        tips: grown.tips.length,
      };
    }
  );
}

/**
 * The sketch: the tray of split soybeans, the hyphae drawn up to the card's
 * hour as white threads, and a white felt that thickens over the beans as the
 * mould covers them. Played, the hours move on and reach the card.
 */
function trayProgram(sketch: p5, read: () => Tray) {
  let hours = 0;
  let shownHours = -1;
  let reported = -1;

  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };

  sketch.draw = () => {
    const tray = read();
    if (tray.hours !== reported) {
      hours = tray.hours;
    }
    if (sketch.isLooping() && shownHours >= 0) {
      hours += Math.min(0.1, sketch.deltaTime / 1000) * HOURS_PER_SECOND;
      if (hours > TEMPEH.hours + 2) {
        hours = 0;
      }
    }
    shownHours = Math.min(TEMPEH.hours, hours);
    const stage =
      tray.stages[
        Math.min(tray.stages.length - 1, Math.round(shownHours / STEP_HOURS))
      ];
    const segments = stage?.segments ?? [];
    const size = Math.min(sketch.width, sketch.height) * 0.94;
    const scale = size / TEMPEH.size;
    const x = (mm: number) => sketch.width / 2 + mm * scale;
    const y = (mm: number) => sketch.height / 2 + mm * scale;

    sketch.background(MATERIAL.leafLitterDark);
    drawBeans(sketch, x, y, scale);
    sketch.stroke(getColor("SLATE", 50));
    sketch.strokeWeight(Math.max(0.6, scale * 0.06));
    sketch.noFill();
    sketch.beginShape(sketch.LINES);
    Arr.forEach(segments, ([x0, y0, x1, y1]) => {
      sketch.vertex(x(x0), y(y0));
      sketch.vertex(x(x1), y(y1));
    });
    sketch.endShape();
    const felt = sketch.color(getColor("SLATE", 50));
    felt.setAlpha(170 * coverOf(segments, COVER_CELLS) ** 2);
    sketch.noStroke();
    sketch.fill(felt);
    sketch.rect(x(-TEMPEH.size / 2), y(-TEMPEH.size / 2), size, size);

    const rounded = Math.round(shownHours / STEP_HOURS) * STEP_HOURS;
    if (sketch.isLooping() && rounded !== reported) {
      reported = rounded;
      tray.report(rounded);
    }
  };
}

/**
 * Split soybean halves about 5.4 mm by 4.2 mm, packed in rows across the
 * tray without touching: each a rounded cotyledon with its paler split face
 * up and the small dark germ notch at one end.
 */
function drawBeans(
  sketch: p5,
  x: (mm: number) => number,
  y: (mm: number) => number,
  scale: number
) {
  const columns = 5;
  const rows = 6;
  sketch.noStroke();
  Arr.forEach(Arr.range(0, columns * rows - 1), (bean) => {
    const column = bean % columns;
    const row = Math.floor(bean / columns);
    const cx =
      -TEMPEH.size / 2 +
      ((column + 0.5) * TEMPEH.size) / columns +
      (hashUnit(bean, 1) - 0.5) * 0.4;
    const cy =
      -TEMPEH.size / 2 +
      ((row + 0.5) * TEMPEH.size) / rows +
      (hashUnit(bean, 2) - 0.5) * 0.3;
    sketch.push();
    sketch.translate(x(cx), y(cy));
    sketch.rotate((hashUnit(bean, 3) - 0.5) * 0.24 + (bean % 2) * Math.PI);
    sketch.stroke(MATERIAL.leafLitter);
    sketch.strokeWeight(Math.max(0.5, 0.12 * scale));
    sketch.fill(MATERIAL.soybean);
    sketch.ellipse(0, 0, 5.4 * scale, 4.2 * scale);
    sketch.noStroke();
    sketch.fill(MATERIAL.soybeanFace);
    sketch.ellipse(0.2 * scale, -0.2 * scale, 4.2 * scale, 3 * scale);
    sketch.fill(MATERIAL.leafLitter);
    sketch.ellipse(-2.1 * scale, 0, 0.7 * scale, 1.1 * scale);
    sketch.pop();
  });
}
