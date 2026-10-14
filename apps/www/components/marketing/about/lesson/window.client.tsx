"use client";

import {
  useFocusWithin,
  useHover,
  useIntersection,
  useInViewport,
  useMergedRef,
  useReducedMotion,
} from "@mantine/hooks";
import { ScenePlaceholder } from "@repo/design-system/components/three/placeholder";
import {
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
} from "@repo/design-system/components/ui/tabs";
import { Array as Arr, Schema } from "effect";
import { type ComponentType, useEffect, useState } from "react";
import {
  AtomVisual,
  BacteriaVisual,
  ProjectileVisual,
  QuadraticVisual,
} from "@/components/marketing/about/lesson/visual.client";

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

/** The product's own visual of each lesson, as a lesson page renders it. */
const VISUALS: Record<Lesson, ComponentType> = {
  cell: BacteriaVisual,
  mole: AtomVisual,
  projectile: ProjectileVisual,
  quadratic: QuadraticVisual,
};

/** How long a lesson stays open before the next one opens by itself. */
const OPEN_FOR_MS = 6000;

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
 * the product's own visual below it. It opens the next lesson by itself while it
 * is on screen. It waits while the reader points at it or has focus in it, starts
 * the count again when the reader picks a lesson, and holds still with reduced
 * motion. Only the open lesson's visual is mounted, and only while the window is
 * in the viewport.
 */
export function LessonWindow({ label, lessons }: LessonWindowProps) {
  const { entry, ref: viewRef } = useIntersection({ threshold: 0.5 });
  const { inViewport, ref: viewportRef } = useInViewport();
  const { hovered, ref: hoverRef } = useHover();
  const { focused, ref: focusRef } = useFocusWithin();
  const ref = useMergedRef(viewRef, viewportRef, hoverRef, focusRef);
  const shouldReduceMotion = useReducedMotion();
  const [lesson, setLesson] = useState<Lesson>("projectile");
  const reading = hovered || focused;
  const playing =
    (entry?.isIntersecting ?? false) && !shouldReduceMotion && !reading;

  useEffect(() => {
    if (!playing) {
      return;
    }
    const timer = window.setTimeout(() => {
      setLesson(NEXT[lesson]);
    }, OPEN_FOR_MS);
    return () => window.clearTimeout(timer);
  }, [lesson, playing]);

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
          const Visual = VISUALS[id];
          return (
            <TabsPanel className="grid gap-6" key={id} value={id}>
              <p className="min-h-36 text-pretty text-base lg:min-h-12">
                {lessons[id].text}
              </p>
              {inViewport ? <Visual /> : <ScenePlaceholder />}
            </TabsPanel>
          );
        })}
      </Tabs>
    </div>
  );
}
