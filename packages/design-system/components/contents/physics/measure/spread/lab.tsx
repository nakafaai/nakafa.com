import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import {
  arrow,
  dashed,
  fade,
  gradientRect,
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { readingStats } from "@repo/design-system/components/contents/physics/measure/data";
import {
  useQuantity,
  useReading,
} from "@repo/design-system/components/contents/simulation/quantity";
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
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { P5Sketch } from "@repo/design-system/components/visual/sketch";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Option, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** One student's readings, in the order taken. */
const StudentSchema = Schema.Struct({
  name: Schema.String,
  readings: Schema.NonEmptyArray(Schema.Finite),
});

/** What the sketch reads on every frame. */
const SpreadFrameSchema = Schema.Struct({
  actual: Schema.Finite,
  actualLabel: Schema.String,
  chosen: Schema.Finite,
  students: Schema.Array(StudentSchema),
});
type SpreadFrame = typeof SpreadFrameSchema.Type;

/**
 * Draws each student's readings as dots on one row of a magnified scale,
 * against a dashed line at the actual value: a tight row is precise, a row
 * centred on the line is accurate. The chosen student's row is lit, with an
 * arrow from the actual value to the mean of the readings.
 */
function spreadProgram(sketch: p5, read: () => SpreadFrame) {
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    const { height, width } = sketch;
    gradientRect(sketch, { height, width, x: 0, y: 0 }, [
      [0, mix(MATERIAL.paper, getColor("BLACK"), 0.78)],
      [1, mix(MATERIAL.paper, getColor("BLACK"), 0.88)],
    ]);
    const all = Arr.flatMap(frame.students, (student) => student.readings);
    const reach =
      Math.max(...Arr.map(all, (reading) => Math.abs(reading - frame.actual))) *
      1.25;
    const left = width * 0.14;
    const right = width * 0.94;
    const x = (reading: number) =>
      left +
      ((reading - (frame.actual - reach)) / (2 * reach)) * (right - left);
    const rowHeight = (height * 0.74) / Math.max(frame.students.length, 1);
    const top = height * 0.12;
    Arr.forEach(frame.students, (student, index) => {
      const y = top + rowHeight * (index + 0.5);
      if (index === frame.chosen) {
        sketch.noStroke();
        sketch.fill(fade(PLOT_COLORS.amber, 0.14));
        sketch.rect(
          left - width * 0.1,
          y - rowHeight / 2,
          right - left + width * 0.12,
          rowHeight,
          6
        );
      }
      sketch.stroke(fade(getColor("WHITE"), 0.2));
      sketch.strokeWeight(1);
      sketch.line(left, y, right, y);
      caption(
        sketch,
        student.name,
        { x: left - width * 0.04, y },
        {
          align: "right",
          baseline: "middle",
          color: getColor("WHITE"),
          size: 14,
        }
      );
      Arr.forEach(student.readings, (reading, order) => {
        const repeated = Arr.filter(
          Arr.take(student.readings, order),
          (earlier) => earlier === reading
        ).length;
        sketch.noStroke();
        sketch.fill(
          index === frame.chosen
            ? PLOT_COLORS.amber
            : fade(getColor("WHITE"), 0.85)
        );
        sketch.circle(x(reading), y - repeated * 10, 9);
      });
      if (index === frame.chosen) {
        const stats = readingStats(student.readings, frame.actual);
        arrow(
          sketch,
          { x: x(frame.actual), y: y + rowHeight * 0.3 },
          { x: x(stats.mean), y: y + rowHeight * 0.3 },
          { color: PLOT_COLORS.pink, head: 9, weight: 2.5 }
        );
      }
    });
    dashed(
      sketch,
      { x: x(frame.actual), y: top - 6 },
      { x: x(frame.actual), y: top + rowHeight * frame.students.length },
      {
        color: PLOT_COLORS.teal,
        dash: 5,
        weight: 2,
      }
    );
    caption(
      sketch,
      frame.actualLabel,
      { x: x(frame.actual), y: top - 10 },
      { align: "center", baseline: "bottom", color: PLOT_COLORS.teal, size: 13 }
    );
    vignette(sketch, 0.25);
  };
}

interface ReadingSpreadLabProps {
  /** The actual value the students measure, in centimetres. */
  actual: number;
  description: ReactNode;
  labels: {
    mean: ReactNode;
    offset: ReactNode;
    range: ReactNode;
    student: string;
    viewLabel: string;
  };
  /** Each student's name and readings, in centimetres. */
  students: readonly {
    readonly name: string;
    readonly readings: readonly [number, ...number[]];
  }[];
  title: ReactNode;
}

/**
 * Several students measure the same object, each with an own instrument,
 * and their readings sit as dots on a magnified scale against the actual
 * value. Choose a student: the range says how precise the readings are, and
 * the offset of their mean from the actual value says how accurate. A small
 * range with a large, steady offset is the mark of a zero error.
 */
export function ReadingSpreadLab({
  actual,
  description,
  labels,
  students,
  title,
}: ReadingSpreadLabProps) {
  const quantity = useQuantity();
  const reading = useReading();
  const [chosen, setChosen] = useState(0);
  const student = Option.getOrElse(
    Arr.get(students, chosen),
    () => students[0]
  );
  const stats =
    student === undefined ? undefined : readingStats(student.readings, actual);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.student}
          onValueChange={(value) => setChosen(Number(value))}
          type="single"
          value={String(chosen)}
          variant="outline"
        >
          {Arr.map(students, (each, index) => (
            <ToggleGroupItem key={each.name} value={String(index)}>
              {each.name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={spreadProgram}
          state={{
            actual,
            actualLabel: `${reading(actual, 2)} cm`,
            chosen,
            students,
          }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        {stats === undefined ? null : (
          <VisualCardFacts>
            <VisualFactTabular
              label={labels.mean}
              value={
                <InlineMath math={quantity(stats.mean, "\\text{ cm}", 3)} />
              }
            />
            <VisualFactTabular
              label={labels.range}
              value={
                <InlineMath math={quantity(stats.range, "\\text{ cm}", 2)} />
              }
            />
            <VisualFactTabular
              label={labels.offset}
              value={
                <InlineMath
                  math={`${stats.offset >= 0 ? "+" : ""}${quantity(stats.offset, "\\text{ cm}", 2)}`}
                />
              }
            />
          </VisualCardFacts>
        )}
      </VisualCardFooter>
    </VisualCard>
  );
}
