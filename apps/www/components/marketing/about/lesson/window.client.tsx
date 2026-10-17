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
import { cn } from "cn";
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
import {
  createLessonSelectionStore,
  LessonSelectionContext,
} from "@/components/marketing/about/lesson/selection";

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

/** The DOM id of one lesson's panel, which its tab controls. */
function panelId(windowId: string, lesson: Lesson) {
  return `${windowId}-panel-${lesson}`;
}

interface LessonPanelProps {
  readonly decimalSeparator: DecimalSeparator;
  readonly id: string;
  readonly labelledBy: string;
  readonly lesson: Lesson;
  readonly lessonContent: HomeLesson;
  readonly live: boolean;
  readonly open: boolean;
  readonly openLabel: string;
  readonly placeholder: ReactNode;
}

/**
 * One lesson's panel: its description and its link, above its card. All four
 * panels share one grid cell, so the window is as tall as its tallest panel and a
 * tab change moves nothing below it. A panel that is not open is hidden by
 * visibility and made inert, so it leaves the accessibility tree and takes no
 * pointer or focus. The open panel's lab replaces its card in the same box once
 * the window is live. The cards of the panels are never skipped by
 * content-visibility: a skipped card takes a fallback height until it is first
 * drawn, so the window would change height when the reader reaches it.
 */
function LessonPanel({
  decimalSeparator,
  id,
  labelledBy,
  lesson,
  lessonContent,
  live,
  open,
  openLabel,
  placeholder,
}: LessonPanelProps) {
  const Lab = LESSON_LABS[lesson];

  return (
    <div
      aria-labelledby={labelledBy}
      className={cn(
        "col-start-1 row-start-1 grid content-start gap-6 [&_.content-auto-card]:[content-visibility:visible]!",
        !open && "invisible"
      )}
      id={id}
      inert={!open}
      role="tabpanel"
    >
      <div className="grid justify-items-start gap-4">
        <p className="text-pretty text-base">{lessonContent.description}</p>
        <Button
          nativeButton={false}
          render={
            <NavigationLink href={lessonContent.href}>
              {openLabel}
            </NavigationLink>
          }
          size="sm"
          variant="outline"
        />
      </div>
      {live ? (
        <Suspense fallback={placeholder}>
          <Lab decimalSeparator={decimalSeparator} />
        </Suspense>
      ) : (
        placeholder
      )}
    </div>
  );
}

/**
 * The lesson window: four published lessons on tabs. Each tab is named by its
 * lesson, and each panel holds the lesson's description, a link that opens the
 * lesson, and the lesson's card. The panels share one grid cell, so the window
 * holds one height from its first paint to every tab. Only the open lesson's lab
 * is mounted: it replaces the card once the window nears the screen, or once its
 * tab is pressed. The window keeps each lab's choice while the reader moves between
 * lessons. The window turns only when the reader picks a tab, never by itself.
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
  const [selections] = useState(createLessonSelectionStore);
  const windowId = useId();

  /** Opens the lesson that the tab names. Any other value leaves the window as it is. */
  function handleChange(value: unknown) {
    if (Schema.is(LessonSchema)(value)) {
      setLesson(value);
    }
  }

  return (
    <LessonSelectionContext value={selections}>
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
                aria-controls={panelId(windowId, id)}
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
          <div className="grid">
            {Arr.map(LessonSchema.literals, (id) => (
              <LessonPanel
                decimalSeparator={decimalSeparator}
                id={panelId(windowId, id)}
                key={id}
                labelledBy={tabId(windowId, id)}
                lesson={id}
                lessonContent={lessons[id]}
                live={revealed && id === lesson}
                open={id === lesson}
                openLabel={openLabel}
                placeholder={placeholders[id]}
              />
            ))}
          </div>
        </Tabs>
      </Intersection>
    </LessonSelectionContext>
  );
}
