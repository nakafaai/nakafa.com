"use client";

import type { DecimalSeparator } from "@repo/design-system/components/contents/physics/kinematics/number";
import { Button } from "@repo/design-system/components/ui/button";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  Tabs,
  TabsList,
  TabsTab,
} from "@repo/design-system/components/ui/tabs";
import { Array as Arr, Schema } from "effect";
import { type ReactNode, Suspense, useId, useState } from "react";
import {
  type Lesson,
  LessonSchema,
} from "@/components/marketing/about/lesson/id";
import {
  LESSON_LABS,
  preloadLessonLab,
} from "@/components/marketing/about/lesson/labs";
import type { HomeLesson } from "@/components/marketing/about/lesson/published";

interface LessonWindowProps {
  /** The decimal separator of the page's locale, which the physics lab writes its numbers with. */
  readonly decimalSeparator: DecimalSeparator;
  readonly label: string;
  readonly lessons: Record<Lesson, HomeLesson>;
  /** The link's text, which names the lesson's page for the reader. */
  readonly openLabel: string;
  /** The static card of each lesson, drawn by the server so the lab takes over the same box. */
  readonly placeholders: Record<Lesson, ReactNode>;
}

/** The DOM id of one lesson's tab, which names its panel for assistive technology. */
function tabId(windowId: string, lesson: Lesson) {
  return `${windowId}-tab-${lesson}`;
}

/** The DOM id of the open lesson's panel, which its tab controls. */
function panelId(windowId: string, lesson: Lesson) {
  return `${windowId}-panel-${lesson}`;
}

/**
 * The lesson window: four published lessons on tabs. Each tab is named by its
 * lesson, and the open panel holds the lesson's description, a link that opens
 * the lesson, and the lesson's card. Only the open lesson is in the page. Its
 * card is drawn by the server, and its lab replaces that card in the same box
 * once the window nears the screen, or once its tab is pressed. The window turns
 * only when the reader picks a tab, never by itself.
 */
export function LessonWindow({
  decimalSeparator,
  label,
  lessons,
  openLabel,
  placeholders,
}: LessonWindowProps) {
  const [lesson, setLesson] = useState<Lesson>("projectile");
  const [revealed, setRevealed] = useState(false);
  const windowId = useId();
  const Lab = LESSON_LABS[lesson];

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
            <TabsTab
              aria-controls={id === lesson ? panelId(windowId, id) : undefined}
              id={tabId(windowId, id)}
              key={id}
              onFocus={() => preloadLessonLab(id)}
              onPointerEnter={() => preloadLessonLab(id)}
              value={id}
            >
              {lessons[id].title}
            </TabsTab>
          ))}
        </TabsList>
        <div
          aria-labelledby={tabId(windowId, lesson)}
          className="grid content-start gap-6"
          id={panelId(windowId, lesson)}
          role="tabpanel"
        >
          <div className="grid justify-items-start gap-4">
            <p className="text-pretty text-base">
              {lessons[lesson].description}
            </p>
            <Button
              nativeButton={false}
              render={
                <NavigationLink href={lessons[lesson].href}>
                  {openLabel}
                </NavigationLink>
              }
              size="sm"
              variant="outline"
            />
          </div>
          {revealed ? (
            <Suspense fallback={placeholders[lesson]}>
              <Lab decimalSeparator={decimalSeparator} />
            </Suspense>
          ) : (
            placeholders[lesson]
          )}
        </div>
      </Tabs>
    </Intersection>
  );
}
