"use client";

import {
  useFocusWithin,
  useHover,
  useIntersection,
  useInViewport,
  useMergedRef,
  useReducedMotion,
} from "@mantine/hooks";
import type { DecimalSeparator } from "@repo/design-system/components/contents/physics/kinematics/number";
import { ScenePlaceholder } from "@repo/design-system/components/three/placeholder";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import {
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
} from "@repo/design-system/components/ui/tabs";
import { Array as Arr, Schema } from "effect";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  type Lesson,
  LessonSchema,
} from "@/components/marketing/about/lesson/id";

/** The product's visual of the open lesson. Its code loads when the window comes into view. */
const LessonVisual = dynamic(
  () =>
    import("@/components/marketing/about/lesson/visual.client").then(
      ({ LessonVisual }) => LessonVisual
    ),
  { loading: ScenePlaceholder }
);

/** The lesson that opens after each one. The window goes round and starts again. */
const NEXT: Record<Lesson, Lesson> = {
  cell: "projectile",
  mole: "cell",
  projectile: "quadratic",
  quadratic: "mole",
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
  /** The decimal separator of the page's locale, which the physics visual writes its numbers with. */
  readonly decimalSeparator: DecimalSeparator;
  readonly label: string;
  readonly lessons: Record<Lesson, LessonCopy>;
}

/**
 * The visual of one lesson. It mounts while the window is in the viewport and
 * stays mounted while the reader has focus inside it, so a control that has
 * focus is never removed: some browsers send no focus event for a removed
 * control, and the window would keep waiting for a reader who has left. Out of
 * view the frame stays still, with no spinner turning.
 */
function LessonScene({
  decimalSeparator,
  inViewport,
  lesson,
}: {
  readonly decimalSeparator: DecimalSeparator;
  readonly inViewport: boolean;
  readonly lesson: Lesson;
}) {
  const { focused, ref } = useFocusWithin();

  return (
    <div className="grid" ref={ref}>
      {inViewport || focused ? (
        <LessonVisual decimalSeparator={decimalSeparator} lesson={lesson} />
      ) : (
        <div aria-hidden="true" className={threeSceneFrameVariants()} />
      )}
    </div>
  );
}

/**
 * The lesson window: four lessons on tabs, each with its text at the top and
 * the product's own visual below it. It opens the next lesson by itself while it
 * is on screen. It waits while the reader points at it or has focus in it, starts
 * the count again when the reader picks a lesson, and holds still with reduced
 * motion. Only the open lesson's visual is mounted, and only while the window is
 * in the viewport or the reader has focus inside it.
 */
export function LessonWindow({
  decimalSeparator,
  label,
  lessons,
}: LessonWindowProps) {
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
        {Arr.map(LessonSchema.literals, (id) => (
          <TabsPanel className="grid gap-6" key={id} value={id}>
            <p className="text-pretty text-base">{lessons[id].text}</p>
            <LessonScene
              decimalSeparator={decimalSeparator}
              inViewport={inViewport}
              lesson={id}
            />
          </TabsPanel>
        ))}
      </Tabs>
    </div>
  );
}
