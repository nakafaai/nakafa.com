import { AnimalFigure } from "@repo/design-system/components/ui/animal";
import { Nina } from "@repo/design-system/components/ui/nina";
import { Thing } from "@repo/design-system/components/ui/thing";
import { Array as Arr } from "effect";
import type { AnimationSequence } from "motion";
import type { CSSProperties } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { DEMO_LEARNERS } from "@/components/marketing/school/features/cast";
import { SchoolFeatureText } from "@/components/marketing/school/features/text";
import {
  FlowDot,
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

/** Where Nina's words end and her help starts: the middle of the stage's top, a little above it. */
const SOURCE = { x: 50, y: -8 };

/** How far down the stage every wire of help ends: just above the learner who stands highest. */
const REACH = 16;

/** How far down the stage the ground lies that every column stands on. */
const GROUND = 78;

/** Where every learner's result ends: the top of the class's mastery, under the ground. */
const RESULT = { x: 50, y: 86 };

/** The mastery of each learner before Nina's help and after it, the one who needs it most first. */
const SCORES = [
  { after: 76, before: 58 },
  { after: 80, before: 71 },
  { after: 85, before: 79 },
  { after: 90, before: 84 },
] as const;

/** The class's mastery, the mean of its learners, before the help and after it. */
const MEAN = {
  after: Arr.reduce(SCORES, 0, (sum, { after }) => sum + after) / 400,
  before: Arr.reduce(SCORES, 0, (sum, { before }) => sum + before) / 400,
};

/**
 * How much of its column a mastery hides under the ground, from 0 for a
 * column that stands whole to 1 for one that is gone: a learner at 40 stands
 * on the ground itself, and one at 100 on the whole column.
 */
function sunk(mastery: number) {
  return 1 - (mastery - 40) / 60;
}

/** The learners side by side, each with the wire that brings help and the wire that carries the result. */
const LEARNERS = Arr.map(SCORES, (score, index) => {
  const x = 14 + 24 * index;
  return {
    ...score,
    gather: wire({ x, y: GROUND }, RESULT, "column"),
    help: wire(SOURCE, { x, y: REACH }, "column"),
    name: `learner-${index}`,
    x,
  };
});

/** Every wire of the picture: help down to each learner, and each learner's result down to the class. */
const WIRES = [
  ...Arr.map(LEARNERS, ({ help, name }) => ({
    name: `help-${name}`,
    path: help,
  })),
  ...Arr.map(LEARNERS, ({ gather, name }) => ({
    name: `gather-${name}`,
    path: gather,
  })),
];

/** A column rises fast and settles slowly, as a thing that grows does. */
const GROW = [0.22, 1, 0.36, 1] as const;

/**
 * The story of the insight picture, eight seconds long: every column sinks
 * back to where its learner began, Nina's help reaches each learner, the one
 * who needs it most first, each column rises as it lands, and the class's
 * mastery follows.
 */
function composeInsight(
  stage: HTMLElement,
  size: typeof Size.Type
): AnimationSequence {
  const all = (selector: string) => stage.querySelectorAll(selector);

  return [
    [all('[data-score="after"]'), { opacity: 0 }, { at: 0, duration: 0.3 }],
    [all('[data-score="before"]'), { opacity: 1 }, { at: 0, duration: 0.3 }],
    [all("[data-meter]"), { scaleX: MEAN.before }, { at: 0, duration: 0.4 }],
    ...Arr.flatMap(
      LEARNERS,
      ({ after, before, help, name }, index): AnimationSequence => {
        const start = 1 + index * 0.5;
        return [
          [
            all(`[data-learner="${name}"] [data-column]`),
            { "--sink": sunk(before) },
            { at: 0, duration: 0.4 },
          ],
          [
            all(`[data-parcel="help-${name}"]`),
            travel(help, size),
            { at: start, duration: 0.7, ease: "linear" },
          ],
          [
            all(`[data-parcel="help-${name}"]`),
            { opacity: [0, 1] },
            { at: start, duration: 0.12 },
          ],
          [
            all(`[data-wire="help-${name}"]`),
            { opacity: [0, 0.5, 0] },
            { at: start, duration: 0.7 },
          ],
          [
            all(`[data-parcel="help-${name}"]`),
            { opacity: 0 },
            { at: start + 0.66, duration: 0.1 },
          ],
          [
            all(`[data-learner="${name}"] [data-column]`),
            { "--sink": sunk(after) },
            { at: start + 0.7, duration: 0.9, ease: GROW },
          ],
          [
            all(`[data-learner="${name}"] [data-score="before"]`),
            { opacity: 0 },
            { at: start + 0.9, duration: 0.15 },
          ],
          [
            all(`[data-learner="${name}"] [data-score="after"]`),
            { opacity: [0, 1] },
            { at: start + 0.9, duration: 0.3 },
          ],
        ];
      }
    ),
    ...Arr.flatMap(LEARNERS, ({ gather, name }, index): AnimationSequence => {
      const start = 4.4 + index * 0.12;
      return [
        [
          all(`[data-parcel="gather-${name}"]`),
          travel(gather, size),
          { at: start, duration: 0.6, ease: "linear" },
        ],
        [
          all(`[data-parcel="gather-${name}"]`),
          { opacity: [0, 1] },
          { at: start, duration: 0.12 },
        ],
        [
          all(`[data-wire="gather-${name}"]`),
          { opacity: [0, 0.5, 0] },
          { at: start, duration: 0.6 },
        ],
        [
          all(`[data-parcel="gather-${name}"]`),
          { opacity: 0 },
          { at: start + 0.54, duration: 0.1 },
        ],
      ];
    }),
    [
      all('[data-result] [data-score="before"]'),
      { opacity: 0 },
      { at: 5.2, duration: 0.15 },
    ],
    [
      all('[data-result] [data-score="after"]'),
      { opacity: [0, 1] },
      { at: 5.2, duration: 0.3 },
    ],
    [
      all("[data-meter]"),
      { scaleX: MEAN.after },
      { at: 5.2, duration: 0.7, ease: GROW },
    ],
    [stage, { opacity: 1 }, { at: 8.5, duration: 0.01 }],
  ];
}

/**
 * One learner of the class, standing on the column of their mastery, which
 * is the colour of the animal's own ground: the column rises out of the
 * ground as far as the mastery reaches, with its number on it, and lifts the
 * learner with it. The ground cuts the column, so
 * only what is above it shows.
 */
function Learner({ index }: { index: number }) {
  const format = useFormatter();
  const { after, before, name, x } = Arr.getUnsafe(LEARNERS, index);
  const mascot = Arr.getUnsafe(DEMO_LEARNERS, index);
  const column: CSSProperties = { "--sink": sunk(after) };

  return (
    <div
      className="[container-type:size] absolute top-0 w-18 -translate-x-1/2 overflow-hidden sm:w-28 lg:w-32"
      data-learner={name}
      style={{ bottom: `${100 - GROUND}%`, left: `${x}%` }}
    >
      <div
        className="absolute inset-x-0 bottom-0 flex translate-y-[calc(var(--sink)*56cqh)] flex-col items-center"
        data-column=""
        style={column}
      >
        <AnimalFigure className="w-14 sm:w-22 lg:w-26" mascot={mascot} />
        <div
          className="grid h-[56cqh] w-full justify-items-center rounded-t-xl pt-2 sm:pt-3"
          style={{ backgroundColor: `#${mascot.ground}` }}
        >
          <span
            className="bg-background text-muted-foreground col-start-1 row-start-1 h-fit rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums opacity-0"
            data-score="before"
          >
            {format.number(before)}
          </span>
          <span
            className="bg-background text-foreground col-start-1 row-start-1 h-fit rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums"
            data-score="after"
          >
            {format.number(after)}
          </span>
        </div>
      </div>
    </div>
  );
}

/** The mastery of the whole class, where every learner's wire ends: its number and the bar that fills with it. */
function ClassMastery() {
  const t = useTranslations("SchoolSite");
  const format = useFormatter();

  return (
    <FlowNode at={RESULT}>
      <div
        className="bg-card ring-foreground/10 grid w-48 gap-2 rounded-xl px-4 py-3 shadow-xs ring-1 sm:w-56"
        data-result=""
      >
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span>{t("insight-mastery")}</span>
          <span className="grid font-mono tabular-nums">
            <span
              className="col-start-1 row-start-1 opacity-0"
              data-score="before"
            >
              {format.number(MEAN.before, { style: "percent" })}
            </span>
            <span className="col-start-1 row-start-1" data-score="after">
              {format.number(MEAN.after, { style: "percent" })}
            </span>
          </span>
        </div>
        <div className="bg-muted h-1.5 overflow-hidden rounded-full">
          <div
            className="bg-success h-full origin-left rounded-full"
            data-meter=""
            style={{ transform: `scaleX(${MEAN.after})` }}
          />
        </div>
      </div>
    </FlowNode>
  );
}

/**
 * The insight part: under Nina and her words, four learners, each standing
 * on the column of their mastery. Her help reaches the one who needs it most
 * first, every column rises and lifts its learner, and the class's mastery
 * rises with them.
 */
export function SchoolInsight() {
  const t = useTranslations("SchoolSite");
  const stage = useFlowPlay(composeInsight);

  return (
    <FeatureRow id="insight" layout="wide">
      <SchoolFeatureText feature="insight">
        <Nina act="searching" label="" size={88} whole />
      </SchoolFeatureText>
      <FeatureProduct>
        <FlowStage
          className="aspect-4/5 max-w-4xl sm:aspect-16/9"
          label={t("insight-picture")}
          ref={stage}
        >
          <FlowWires wires={WIRES} />
          {Arr.map(LEARNERS, ({ name }, index) => (
            <Learner index={index} key={name} />
          ))}
          <div
            className="absolute inset-x-0 border-t"
            style={{ top: `${GROUND}%` }}
          />
          <ClassMastery />
          {Arr.map(LEARNERS, ({ name }) => (
            <FlowParcel key={`help-${name}`} name={`help-${name}`}>
              <Thing name="bulb" size={32} />
            </FlowParcel>
          ))}
          {Arr.map(LEARNERS, ({ name }) => (
            <FlowParcel key={`gather-${name}`} name={`gather-${name}`}>
              <FlowDot />
            </FlowParcel>
          ))}
        </FlowStage>
      </FeatureProduct>
    </FeatureRow>
  );
}
