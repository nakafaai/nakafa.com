"use client";

import type { DecimalSeparator } from "@repo/design-system/components/contents/physics/kinematics/number";
import { ScenePlaceholder } from "@repo/design-system/components/three/placeholder";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
} from "@repo/design-system/components/ui/tabs";
import { Array as Arr, Schema } from "effect";
import dynamic from "next/dynamic";
import { useState } from "react";
import {
  type Lesson,
  LessonSchema,
} from "@/components/marketing/about/lesson/id";

/** The product's visual of the open lesson. Its code loads when the window nears the screen. */
const LessonVisual = dynamic(
  () =>
    import("@/components/marketing/about/lesson/visual.client").then(
      ({ LessonVisual }) => LessonVisual
    ),
  { loading: ScenePlaceholder }
);

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
 * The visual of one lesson. A frame of the same shape holds its place until the
 * window is revealed. The visual then stays mounted for good, so a control with
 * focus is never removed, and each lab rests on its own while it is out of view.
 */
function LessonScene({
  decimalSeparator,
  lesson,
  revealed,
}: {
  readonly decimalSeparator: DecimalSeparator;
  readonly lesson: Lesson;
  readonly revealed: boolean;
}) {
  return (
    <div className="grid">
      {revealed ? (
        <LessonVisual decimalSeparator={decimalSeparator} lesson={lesson} />
      ) : (
        <div aria-hidden="true" className={threeSceneFrameVariants()} />
      )}
    </div>
  );
}

/**
 * The lesson window: four lessons on tabs, each with its text at the top and
 * the product's own visual below it. The window turns only when the reader picks
 * a tab, never by itself. It is revealed once it comes within one screen height
 * of the viewport, so the visual of the open lesson is drawn before the reader
 * reaches it, and it stays mounted after that.
 */
export function LessonWindow({
  decimalSeparator,
  label,
  lessons,
}: LessonWindowProps) {
  const [lesson, setLesson] = useState<Lesson>("projectile");
  const [revealed, setRevealed] = useState(false);

  /** Opens the lesson that the tab names. Any other value leaves the window as it is. */
  function handleChange(value: unknown) {
    if (Schema.is(LessonSchema)(value)) {
      setLesson(value);
    }
  }

  return (
    <Intersection
      className="grid gap-6"
      once
      onIntersect={() => setRevealed(true)}
      rootMargin="100% 0px"
      threshold={0}
    >
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
              lesson={id}
              revealed={revealed}
            />
          </TabsPanel>
        ))}
      </Tabs>
    </Intersection>
  );
}
