import { AnimalFigure } from "@repo/design-system/components/ui/animal";
import { Nina } from "@repo/design-system/components/ui/nina";
import { Thing } from "@repo/design-system/components/ui/thing";
import { Array as Arr } from "effect";
import type { AnimationSequence } from "motion";
import { useFormatter, useTranslations } from "use-intl";
import { DEMO_CLASS } from "@/components/marketing/school/features/cast";
import { SchoolFeatureText } from "@/components/marketing/school/features/text";
import {
  FlowNode,
  FlowParcel,
  FlowStage,
  FlowWires,
  useFlowPlay,
} from "@/components/marketing/school/flow/stage";
import {
  type Size,
  travel,
  wire,
} from "@/components/marketing/school/flow/wire";
import {
  FeatureProduct,
  FeatureRow,
} from "@/components/marketing/shared/feature";

/** Where Nina's words end and every worksheet starts: the middle of the stage's top, a little above it. */
const SOURCE = { x: 50, y: -8 };

/** The grade each student of the class gets back, in the order they sit. */
const GRADES = [92, 85, 78, 96] as const;

/** The order the students hand their work in, which is never the order they sit in. */
const HAND_IN = [1, 3, 0, 2] as const;

/** The seats of the class, in one row, each with the wire its worksheet travels. */
const SEATS = Arr.map(GRADES, (grade, index) => {
  const at = { x: 12.5 + 25 * index, y: 40 };
  return {
    at,
    grade,
    name: `seat-${index}`,
    path: wire(SOURCE, { x: at.x, y: at.y + 4 }, "column"),
  };
});

/** A sheet or a grade arrives with a small overshoot, like a thing put down. */
const LAND = [0.34, 1.56, 0.64, 1] as const;

/**
 * The story of the tasks picture, eight seconds long: the last grades clear,
 * a worksheet travels to every seat, the students hand it in one by one in an
 * order of their own, and each gets a grade back.
 */
function composeTasks(
  stage: HTMLElement,
  size: typeof Size.Type
): AnimationSequence {
  const part = (name: string, index: number) =>
    stage.querySelectorAll(`[data-${name}="seat-${index}"]`);

  return [
    [
      stage.querySelectorAll("[data-grade]"),
      { opacity: 0, scale: 0.6 },
      { at: 0, duration: 0.3 },
    ],
    ...Arr.flatMap(SEATS, ({ path }, index): AnimationSequence => {
      const start = 0.6 + index * 0.2;
      return [
        [
          part("parcel", index),
          travel(path, size),
          { at: start, duration: 0.9, ease: "linear" },
        ],
        [
          part("parcel", index),
          { opacity: [0, 1] },
          { at: start, duration: 0.12 },
        ],
        [
          part("wire", index),
          { opacity: [0, 0.5, 0] },
          { at: start, duration: 0.9 },
        ],
        [
          part("parcel", index),
          { opacity: 0 },
          { at: start + 0.86, duration: 0.1 },
        ],
        [
          part("sheet", index),
          { opacity: [0, 1], scale: [0.6, 1] },
          { at: start + 0.84, duration: 0.3, ease: LAND },
        ],
      ];
    }),
    ...Arr.flatMap(HAND_IN, (index, turn): AnimationSequence => {
      const start = 3.2 + turn * 0.3;
      const way = travel(Arr.getUnsafe(SEATS, index).path, size);
      return [
        [
          part("sheet", index),
          { opacity: 0, scale: 0.6 },
          { at: start, duration: 0.15 },
        ],
        [
          part("parcel", index),
          { x: Arr.reverse(way.x), y: Arr.reverse(way.y) },
          { at: start, duration: 0.8, ease: "linear" },
        ],
        [
          part("parcel", index),
          { opacity: [0, 1] },
          { at: start, duration: 0.12 },
        ],
        [
          part("wire", index),
          { opacity: [0, 0.5, 0] },
          { at: start, duration: 0.8 },
        ],
        [
          part("parcel", index),
          { opacity: 0 },
          { at: start + 0.72, duration: 0.1 },
        ],
      ];
    }),
    ...Arr.map(SEATS, (_, index): AnimationSequence[number] => [
      part("grade", index),
      { opacity: [0, 1], scale: [0.6, 1] },
      { at: 5.2 + index * 0.15, duration: 0.35, ease: LAND },
    ]),
    [stage, { opacity: 1 }, { at: 8, duration: 0.01 }],
  ];
}

/**
 * One student at a desk: their animal standing behind it, the desk in the
 * colour of the animal's own ground, and on the desk the worksheet while they
 * work on it, then the grade they get back.
 */
function Seat({ index }: { index: number }) {
  const format = useFormatter();
  const { at, grade, name } = Arr.getUnsafe(SEATS, index);
  const mascot = Arr.getUnsafe(DEMO_CLASS, index);

  return (
    <FlowNode at={at}>
      <div className="grid w-20 justify-items-center sm:w-32 lg:w-44">
        <AnimalFigure className="w-16 sm:w-26 lg:w-36" mascot={mascot} />
        <div
          className="grid h-11 w-full place-items-center rounded-xl sm:h-14 lg:h-16"
          style={{ backgroundColor: `#${mascot.ground}` }}
        >
          <span className="col-start-1 row-start-1 opacity-0" data-sheet={name}>
            <Thing name="note" size={36} />
          </span>
          <span
            className="bg-background text-foreground col-start-1 row-start-1 rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums"
            data-grade={name}
          >
            {format.number(grade)}
          </span>
        </div>
      </div>
    </FlowNode>
  );
}

/**
 * The tasks part: under Nina and her words, a class of four at their desks.
 * A worksheet travels from her to every student, they hand it in, and each
 * gets a grade back, which is the whole of giving, collecting and grading.
 */
export function SchoolTasks() {
  const t = useTranslations("SchoolSite");
  const stage = useFlowPlay(composeTasks);

  return (
    <FeatureRow id="tasks" layout="wide">
      <SchoolFeatureText feature="tasks">
        <Nina act="carrying" label="" size={88} whole />
      </SchoolFeatureText>
      <FeatureProduct>
        <FlowStage
          className="aspect-4/3 max-w-4xl sm:aspect-2/1"
          label={t("tasks-picture")}
          ref={stage}
        >
          <FlowWires wires={SEATS} />
          {Arr.map(SEATS, ({ name }, index) => (
            <Seat index={index} key={name} />
          ))}
          {Arr.map(SEATS, ({ name }) => (
            <FlowParcel key={name} name={name}>
              <Thing name="note" size={40} />
            </FlowParcel>
          ))}
        </FlowStage>
      </FeatureProduct>
    </FeatureRow>
  );
}
