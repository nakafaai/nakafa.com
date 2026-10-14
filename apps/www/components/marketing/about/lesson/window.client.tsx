"use client";

import { useIntersection } from "@mantine/hooks";
import {
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
} from "@repo/design-system/components/ui/tabs";
import { Array as Arr, Schema } from "effect";
import { useReducedMotion } from "motion/react";
import { type ReactElement, useEffect, useState } from "react";
import {
  bondEnds,
  fitBox,
  pathData,
  projectilePath,
  quadraticPath,
} from "@/components/marketing/about/lesson/curve";

/** The four lessons of the window, in the order they open. */
const LessonSchema = Schema.Literals([
  "projectile",
  "quadratic",
  "mole",
  "cell",
]);

/** One lesson of the window. */
type Lesson = typeof LessonSchema.Type;

/** The lesson that opens after each one. The window goes round and starts again. */
const NEXT: Record<Lesson, Lesson> = {
  cell: "projectile",
  mole: "cell",
  projectile: "quadratic",
  quadratic: "mole",
};

/** How long a lesson stays open before the next one opens by itself. */
const OPEN_FOR_MS = 6000;

/** The size of every lesson picture, in the units of its own svg. */
const WIDTH = 300;
const HEIGHT = 150;

/** The flight of a ball thrown at 40 m/s and 60 degrees, from its formula. */
const FLIGHT = projectilePath(40, 60);
const FLIGHT_PATH = pathData(FLIGHT, fitBox(FLIGHT, WIDTH, HEIGHT));

/** The curve of x squared minus four x plus three, across its two roots. */
const PARABOLA = quadraticPath(-0.5, 4.5);
const PARABOLA_PATH = pathData(PARABOLA, fitBox(PARABOLA, WIDTH, HEIGHT));

/** The two bonds of a water molecule, at its 104.5 degree angle. */
const BONDS = bondEnds(104.5, 60);
const OXYGEN = { x: WIDTH / 2, y: HEIGHT * 0.7 };

/** The trajectory of the ball, drawn on the ground line of its picture. */
function ProjectileFigure() {
  return (
    <svg
      aria-hidden="true"
      className="h-40 w-full overflow-visible"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
    >
      <line
        className="stroke-1 stroke-border"
        x1="0"
        x2={WIDTH}
        y1={HEIGHT}
        y2={HEIGHT}
      />
      <path className="fill-none stroke-2 stroke-primary" d={FLIGHT_PATH} />
    </svg>
  );
}

/** The curve of the quadratic, with its axis at the height of zero. */
function QuadraticFigure() {
  return (
    <svg
      aria-hidden="true"
      className="h-40 w-full overflow-visible"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
    >
      <path className="fill-none stroke-2 stroke-primary" d={PARABOLA_PATH} />
    </svg>
  );
}

/** The bent water molecule, one oxygen and two hydrogens, drawn flat. */
function MoleFigure() {
  return (
    <svg
      aria-hidden="true"
      className="h-40 w-full overflow-visible"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
    >
      {Arr.map(BONDS, (end) => (
        <line
          className="stroke-2 stroke-muted-foreground"
          key={`${end.x}-${end.y}`}
          x1={OXYGEN.x}
          x2={OXYGEN.x + end.x}
          y1={OXYGEN.y}
          y2={OXYGEN.y + end.y}
        />
      ))}
      <circle className="fill-primary" cx={OXYGEN.x} cy={OXYGEN.y} r="16" />
      {Arr.map(BONDS, (end) => (
        <circle
          className="fill-muted-foreground"
          cx={OXYGEN.x + end.x}
          cy={OXYGEN.y + end.y}
          key={`atom-${end.x}-${end.y}`}
          r="9"
        />
      ))}
    </svg>
  );
}

/** A cell as a flat membrane around a nucleus and its small parts. */
function CellFigure() {
  return (
    <svg
      aria-hidden="true"
      className="h-40 w-full overflow-visible"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
    >
      <ellipse
        className="fill-muted stroke-2 stroke-primary"
        cx={WIDTH / 2}
        cy={HEIGHT / 2}
        rx="120"
        ry="62"
      />
      <circle className="fill-primary" cx={WIDTH / 2} cy={HEIGHT / 2} r="26" />
      <circle
        className="fill-muted-foreground"
        cx={WIDTH / 2 - 70}
        cy={HEIGHT / 2 - 24}
        r="8"
      />
      <circle
        className="fill-muted-foreground"
        cx={WIDTH / 2 + 74}
        cy={HEIGHT / 2 + 20}
        r="8"
      />
    </svg>
  );
}

/** The picture of each lesson, by the lesson it shows. */
const FIGURES: Record<Lesson, () => ReactElement> = {
  cell: CellFigure,
  mole: MoleFigure,
  projectile: ProjectileFigure,
  quadratic: QuadraticFigure,
};

const LessonCopySchema = Schema.Struct({
  tab: Schema.String,
  text: Schema.String,
});

/** The title and the text of one lesson, as the page words them. */
type LessonCopy = typeof LessonCopySchema.Type;

interface LessonWindowProps {
  readonly label: string;
  readonly lessons: Record<Lesson, LessonCopy>;
}

/**
 * The lesson window: four lessons on tabs, each with its text at the top and
 * its picture at the bottom. It opens the next lesson by itself while it is on
 * screen, stops when it leaves the screen, and holds still with reduced motion.
 */
export function LessonWindow({ label, lessons }: LessonWindowProps) {
  const { entry, ref } = useIntersection({ threshold: 0.5 });
  const shouldReduceMotion = useReducedMotion() ?? false;
  const [lesson, setLesson] = useState<Lesson>("projectile");
  const playing = (entry?.isIntersecting ?? false) && !shouldReduceMotion;

  useEffect(() => {
    if (!playing) {
      return;
    }
    const timer = window.setInterval(() => {
      setLesson((current) => NEXT[current]);
    }, OPEN_FOR_MS);
    return () => window.clearInterval(timer);
  }, [playing]);

  /** Opens the lesson that the tab names. Any other value leaves the window as it is. */
  function handleChange(value: unknown) {
    if (Schema.is(LessonSchema)(value)) {
      setLesson(value);
    }
  }

  return (
    <div className="grid gap-6" ref={ref}>
      <Tabs onValueChange={handleChange} value={lesson}>
        <TabsList
          aria-label={label}
          className="w-full flex-nowrap overflow-x-auto"
        >
          {Arr.map(LessonSchema.literals, (id) => (
            <TabsTab key={id} value={id}>
              {lessons[id].tab}
            </TabsTab>
          ))}
        </TabsList>
        {Arr.map(LessonSchema.literals, (id) => {
          const Figure = FIGURES[id];
          return (
            <TabsPanel className="grid gap-6" key={id} value={id}>
              <p className="min-h-12 text-pretty text-base">
                {lessons[id].text}
              </p>
              <Figure />
            </TabsPanel>
          );
        })}
      </Tabs>
    </div>
  );
}
