"use client";

import { useIntersection, useReducedMotion } from "@mantine/hooks";
import { Array as Arr } from "effect";
import { useEffect, useState } from "react";

/** The time between two letters of the topic that is being typed. */
const TYPE_EVERY_MS = 90;

/** How long a finished topic stays on the page before it is deleted. */
const HOLD_MS = 2400;

/** The time between two letters of the topic that is being deleted. */
const DELETE_EVERY_MS = 45;

interface ClosingQuestionProps {
  /** The question as the locale words it, with `{topic}` where the topic goes. */
  readonly template: string;
  /** The topics that take turns in the question. The first one is the one it rests on. */
  readonly topics: Arr.NonEmptyReadonlyArray<string>;
}

/**
 * The closing question at the size of the hero, with one of its topics typed in
 * place of the placeholder. The words before the topic make the first line, and
 * the topic with the words after it the second. The whole topic is laid out
 * from its first letter and its letters only turn visible, so typing never
 * moves the words after it, and each topic is a new element, so the next topic
 * is painted in place instead of moving the last one. The line keeps the room
 * of the longest topic, so a topic that wraps on a phone never changes the
 * height of the question. The topics take turns while the question is on
 * screen: each one is typed, held, then deleted letter by letter before the
 * next is typed, with a caret that blinks where the next letter goes. With
 * reduced motion the question rests on its first topic, with no caret.
 */
export function ClosingQuestion({ template, topics }: ClosingQuestionProps) {
  const { entry, ref } = useIntersection({ threshold: 0.5 });
  const shouldReduceMotion = useReducedMotion();
  const [topic, setTopic] = useState(0);
  const [typed, setTyped] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const playing = (entry?.isIntersecting ?? false) && !shouldReduceMotion;
  const current = shouldReduceMotion
    ? topics[0]
    : topics[topic % topics.length];
  const shown = shouldReduceMotion ? current.length : typed;
  const longest = Arr.reduce(topics, "", (best, text) =>
    text.length > best.length ? text : best
  );
  const [before = "", after = ""] = template.split("{topic}");

  useEffect(() => {
    if (!playing) {
      return;
    }
    const topicText = topics[topic % topics.length];
    if (deleting) {
      const timer = window.setTimeout(() => {
        if (typed > 0) {
          setTyped((count) => count - 1);
          return;
        }
        setDeleting(false);
        setTopic((index) => (index + 1) % topics.length);
      }, DELETE_EVERY_MS);
      return () => window.clearTimeout(timer);
    }
    const finished = typed >= topicText.length;
    const timer = window.setTimeout(
      () => {
        if (finished) {
          setDeleting(true);
          return;
        }
        setTyped((count) => count + 1);
      },
      finished ? HOLD_MS : TYPE_EVERY_MS
    );
    return () => window.clearTimeout(timer);
  }, [deleting, playing, topic, topics, typed]);

  return (
    <h2
      className="text-balance text-[2.5rem] leading-[1.1] tracking-tight md:text-[3rem] lg:text-[4rem]"
      ref={ref}
    >
      {before.trim()}
      <span className="grid">
        <span aria-hidden="true" className="invisible col-start-1 row-start-1">
          {longest}
          {after}
        </span>
        <span className="col-start-1 row-start-1" key={current}>
          <span className="text-primary">{current.slice(0, shown)}</span>
          {shouldReduceMotion ? null : <ClosingCaret />}
          <span className="invisible">{current.slice(shown)}</span>
          {/* The words after the topic show once it is typed, so the question
              mark never waits at the end of letters not typed yet. */}
          <span className={shown < current.length ? "invisible" : undefined}>
            {after}
          </span>
        </span>
      </span>
    </h2>
  );
}

/**
 * The caret where the next letter goes. It takes no width, so the letters
 * around it never move, and it blinks the way a text field's caret does.
 */
function ClosingCaret() {
  return (
    <span aria-hidden="true" className="relative inline-block w-0">
      <span className="absolute inset-y-[0.12em] start-0.5 w-[0.06em] animate-pulse rounded-full bg-primary" />
    </span>
  );
}
