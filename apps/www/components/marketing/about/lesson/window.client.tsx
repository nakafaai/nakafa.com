"use client";

import type { DecimalSeparator } from "@repo/design-system/components/contents/physics/kinematics/number";
import { ScenePlaceholder } from "@repo/design-system/components/three/placeholder";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import { Button } from "@repo/design-system/components/ui/button";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
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
import type { HomeLesson } from "@/components/marketing/about/lesson/published";

/** The product's visual of the open lesson. Its code loads when the window nears the screen. */
const LessonVisual = dynamic(
  () =>
    import("@/components/marketing/about/lesson/visual.client").then(
      ({ LessonVisual }) => LessonVisual
    ),
  { loading: ScenePlaceholder }
);

interface LessonWindowProps {
  /** The decimal separator of the page's locale, which the physics visual writes its numbers with. */
  readonly decimalSeparator: DecimalSeparator;
  readonly label: string;
  readonly lessons: Record<Lesson, HomeLesson>;
  /** The link's text, which names the lesson's page for the reader. */
  readonly openLabel: string;
}

/**
 * The visual of one lesson. A frame of the same shape holds its place until the
 * window is revealed. The visual then stays mounted for good, so a control with
 * focus is never removed, and each lab rests on its own while it is out of view.
 */
function LessonScene({
  decimalSeparator,
  lesson,
  published,
  revealed,
}: {
  readonly decimalSeparator: DecimalSeparator;
  readonly lesson: Lesson;
  readonly published: HomeLesson;
  readonly revealed: boolean;
}) {
  return (
    <div className="grid">
      {revealed ? (
        <LessonVisual
          decimalSeparator={decimalSeparator}
          lesson={lesson}
          published={published}
        />
      ) : (
        <div aria-hidden="true" className={threeSceneFrameVariants()} />
      )}
    </div>
  );
}

/**
 * The lesson window: four published lessons on tabs. Each tab is named by its
 * lesson, its text is the lesson's description, and a link opens the lesson.
 * The window turns only when the reader picks a tab, never by itself. It is
 * revealed once it comes within one screen height of the viewport, so the
 * visual of the open lesson is drawn before the reader reaches it, and it stays
 * mounted after that.
 */
export function LessonWindow({
  decimalSeparator,
  label,
  lessons,
  openLabel,
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
              {lessons[id].title}
            </TabsTab>
          ))}
        </TabsList>
        {Arr.map(LessonSchema.literals, (id) => (
          <TabsPanel className="grid gap-6" key={id} value={id}>
            <div className="grid justify-items-start gap-4">
              <p className="text-pretty text-base">{lessons[id].description}</p>
              <Button
                nativeButton={false}
                render={
                  <NavigationLink href={lessons[id].href}>
                    {openLabel}
                  </NavigationLink>
                }
                size="sm"
                variant="outline"
              />
            </div>
            <LessonScene
              decimalSeparator={decimalSeparator}
              lesson={id}
              published={lessons[id]}
              revealed={revealed}
            />
          </TabsPanel>
        ))}
      </Tabs>
    </Intersection>
  );
}
