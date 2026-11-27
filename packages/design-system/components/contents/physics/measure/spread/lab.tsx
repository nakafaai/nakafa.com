import { readingStats } from "@repo/design-system/components/contents/physics/measure/data";
import { BoardScene } from "@repo/design-system/components/contents/physics/measure/spread/scene";
import {
  useQuantity,
  useReading,
} from "@repo/design-system/components/contents/simulation/quantity";
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
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

interface ReadingSpreadLabProps {
  /** The actual value the students measure, in centimetres. */
  actual: number;
  description: NonNullable<ReactNode>;
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
  title: NonNullable<ReactNode>;
}

/**
 * Several students measure the same object, each with an own instrument,
 * and their readings sit as dots on the class results board against the
 * actual value. Choose a student: the range says how precise the readings are, and
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
    <VisualCard
      onReset={() => {
        setChosen(0);
      }}
    >
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
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="epoxy" reach={1.4} setting="lab">
          <Suspense fallback={null}>
            <BoardScene
              actual={actual}
              chosen={chosen}
              label={`${reading(actual, 2)} cm`}
              students={students}
            />
          </Suspense>
        </ScienceStage>
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
