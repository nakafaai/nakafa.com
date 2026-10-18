"use client";

import {
  useFocusWithin,
  useHover,
  useIntersection,
  useMergedRef,
  useReducedMotion,
} from "@mantine/hooks";
import { getMaterialIcons } from "@repo/contents/curriculum/material";
import type { DecimalSeparator } from "@repo/design-system/components/contents/physics/kinematics/number";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { cva } from "class-variance-authority";
import { Array as Arr } from "effect";
import { type ReactNode, Suspense, useEffect, useId, useState } from "react";
import {
  LESSON_SUBJECTS,
  type Lesson,
  LessonSchema,
} from "@/components/marketing/about/lesson/id";
import {
  LESSON_LABS,
  preloadLessonLab,
} from "@/components/marketing/about/lesson/labs";
import { LAB_VISIBLE_SHARE } from "@/components/marketing/about/lesson/reveal";
import {
  createLessonSelectionStore,
  LessonSelectionContext,
} from "@/components/marketing/about/lesson/selection";

/** How long one lesson stays open before the next one opens by itself. */
const TURN_EVERY_MS = 6000;

interface LessonWindowProps {
  /** The decimal separator of the page's locale, which the physics lab writes its numbers with. */
  readonly decimalSeparator: DecimalSeparator;
  readonly label: string;
  /** The static card of each lesson, drawn by the server so the lab takes over the same box. */
  readonly placeholders: Record<Lesson, ReactNode>;
  /** The name of each lesson's subject in the page's locale, which its button shows. */
  readonly subjects: Record<Lesson, string>;
}

/** The DOM id of one lesson's button, which names its panel for assistive technology. */
function buttonId(windowId: string, lesson: Lesson) {
  return `${windowId}-button-${lesson}`;
}

/** The DOM id of one lesson's panel, which its button controls. */
function panelId(windowId: string, lesson: Lesson) {
  return `${windowId}-panel-${lesson}`;
}

/** The lesson after each one in the order of the buttons, back to the first after the last. */
const NEXT_LESSON = {
  atom: "cell",
  cell: "projectile",
  circle: "atom",
  projectile: "circle",
} as const satisfies Record<Lesson, Lesson>;

/**
 * A lesson's panel, open or not. The open one comes in a little from below as
 * it fades in, and the one it replaces fades out where it is, so a lesson change
 * reads as one card turning into the next.
 */
const panelVariants = cva(
  "col-start-1 row-start-1 grid content-start transition-[opacity,translate,visibility] duration-300 ease-out motion-reduce:transition-none [&_.content-auto-card]:[content-visibility:visible]!",
  {
    variants: {
      open: {
        false: "invisible translate-y-2 opacity-0",
        true: "visible translate-y-0 opacity-100",
      },
    },
  }
);

interface LessonPanelProps {
  readonly decimalSeparator: DecimalSeparator;
  readonly id: string;
  readonly labelledBy: string;
  readonly lesson: Lesson;
  readonly live: boolean;
  readonly open: boolean;
  readonly placeholder: ReactNode;
}

/**
 * One lesson's card. All four panels share one grid cell, so the window is as
 * tall as its tallest card and a lesson change moves nothing below it. A panel
 * that is not open is hidden by visibility and made inert, so it leaves the
 * accessibility tree and takes no pointer or focus. The open panel's lab
 * replaces its card in the same box once the window is live. The card's
 * controls are inert until its lab mounts, so no control of the card can hold
 * focus when the lab replaces it, while the card's text and its scene stay in
 * the accessibility tree. The cards of the panels are never skipped by
 * content-visibility: a skipped card takes a fallback height until it is first
 * drawn, so the window would change height when the reader reaches it.
 */
function LessonPanel({
  decimalSeparator,
  id,
  labelledBy,
  lesson,
  live,
  open,
  placeholder,
}: LessonPanelProps) {
  const Lab = LESSON_LABS[lesson];

  return (
    <section
      aria-labelledby={labelledBy}
      className={panelVariants({ open })}
      data-slot="lesson-panel"
      id={id}
      inert={!open}
    >
      {live ? (
        <Suspense fallback={placeholder}>
          <Lab decimalSeparator={decimalSeparator} />
        </Suspense>
      ) : (
        placeholder
      )}
    </section>
  );
}

/**
 * One subject's button: its icon, and its name from the small width up. It is a
 * toggle: the open lesson's button is pressed and filled.
 */
function LessonButton({
  lesson,
  name,
  onOpen,
  open,
  windowId,
}: {
  lesson: Lesson;
  name: string;
  onOpen: (lesson: Lesson) => void;
  open: boolean;
  windowId: string;
}) {
  const [icon] = getMaterialIcons(LESSON_SUBJECTS[lesson]);

  return (
    <Button
      aria-controls={panelId(windowId, lesson)}
      aria-pressed={open}
      className="flex-1 sm:flex-none"
      id={buttonId(windowId, lesson)}
      onClick={() => onOpen(lesson)}
      onFocus={() => preloadLessonLab(lesson)}
      onPointerEnter={() => preloadLessonLab(lesson)}
      title={name}
      variant={open ? "default" : "outline"}
    >
      <HugeIcons icon={icon} />
      <span className="sr-only sm:not-sr-only">{name}</span>
    </Button>
  );
}

/**
 * The lesson window: four lessons, one for each subject on its button. Each panel
 * is the lesson's own card. The panels share one grid cell, so the window holds
 * one height from its first paint to every lesson. Only the open lesson's lab is
 * mounted, and its code loads once at least half of the window is on the
 * screen, or once the reader points at, focuses or presses the window. Until
 * then the server's card shows in the same box. The window keeps each lab's
 * choice while the reader moves between lessons.
 *
 * Nothing has to be pressed to see the lessons: while the window is on screen
 * the next lesson opens every six seconds. It waits while the reader points at
 * the window or has the focus in it, and it stops for good once the reader picks
 * a lesson. With reduced motion it never turns by itself. The lessons are a
 * button group, one row at every width.
 */
export function LessonWindow({
  decimalSeparator,
  label,
  placeholders,
  subjects,
}: LessonWindowProps) {
  const [lesson, setLesson] = useState<Lesson>("projectile");
  const [revealed, setRevealed] = useState(false);
  const [chosen, setChosen] = useState(false);
  const [selections] = useState(createLessonSelectionStore);
  const windowId = useId();
  const shouldReduceMotion = useReducedMotion();
  const { entry, ref: viewRef } = useIntersection({
    threshold: LAB_VISIBLE_SHARE,
  });
  const { hovered, ref: hoverRef } = useHover();
  const { focused, ref: focusRef } = useFocusWithin();
  const ref = useMergedRef(viewRef, hoverRef, focusRef);
  const held = hovered || focused;
  const turning =
    (entry?.isIntersecting ?? false) && !held && !chosen && !shouldReduceMotion;

  useEffect(() => {
    if (!turning) {
      return;
    }
    const timer = window.setTimeout(() => {
      setLesson((current) => NEXT_LESSON[current]);
      setRevealed(true);
    }, TURN_EVERY_MS);
    return () => window.clearTimeout(timer);
  }, [turning]);

  /** Lets the open lesson's lab load and mount. It never turns back once it is revealed. */
  function reveal() {
    setRevealed(true);
  }

  /** Opens the lesson that the reader picked, which stops the window turning by itself. */
  function open(picked: Lesson) {
    setLesson(picked);
    setChosen(true);
    reveal();
  }

  return (
    <LessonSelectionContext value={selections}>
      {/* One column that may shrink below its content, so nothing in it widens
          the page on a phone. */}
      <div className="grid grid-cols-1" ref={ref}>
        <Intersection
          className="grid grid-cols-1 gap-6"
          data-slot="lesson-window"
          minimumRatio={LAB_VISIBLE_SHARE}
          once
          onFocus={reveal}
          onIntersect={reveal}
          onPointerDown={reveal}
          onPointerEnter={reveal}
          rootMargin="0px"
        >
          <ButtonGroup aria-label={label} className="w-full sm:w-fit">
            {Arr.map(LessonSchema.literals, (id) => (
              <LessonButton
                key={id}
                lesson={id}
                name={subjects[id]}
                onOpen={open}
                open={id === lesson}
                windowId={windowId}
              />
            ))}
          </ButtonGroup>
          <div className="grid grid-cols-1">
            {Arr.map(LessonSchema.literals, (id) => (
              <LessonPanel
                decimalSeparator={decimalSeparator}
                id={panelId(windowId, id)}
                key={id}
                labelledBy={buttonId(windowId, id)}
                lesson={id}
                live={revealed && id === lesson}
                open={id === lesson}
                placeholder={placeholders[id]}
              />
            ))}
          </div>
        </Intersection>
      </div>
    </LessonSelectionContext>
  );
}
