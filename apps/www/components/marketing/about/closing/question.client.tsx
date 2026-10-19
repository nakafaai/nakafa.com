"use client";

import { useIntersection, useReducedMotion } from "@mantine/hooks";
import {
  TypedText,
  useTypedLetters,
} from "@repo/design-system/components/ui/typed";
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
 * the topic with the words after it the second. The line keeps the room of the
 * longest topic, so a topic that wraps on a phone never changes the height of the
 * question, and each topic is a new element, so the next topic is painted in
 * place instead of moving the last one. The topics take turns while the question
 * is on screen: each one is typed, held, then deleted letter by letter before the
 * next is typed, with a caret that blinks where the next letter goes. With reduced
 * motion the question rests on its first topic, with no caret.
 */
export function ClosingQuestion({ template, topics }: ClosingQuestionProps) {
  const { entry, ref } = useIntersection({ threshold: 0.5 });
  const shouldReduceMotion = useReducedMotion();
  const [topic, setTopic] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const playing = (entry?.isIntersecting ?? false) && !shouldReduceMotion;
  const current = shouldReduceMotion
    ? topics[0]
    : topics[topic % topics.length];
  // The letters written so far move toward the topic, or toward none while it is deleted.
  const target = deleting ? 0 : current.length;
  const typed = useTypedLetters(target, {
    playing,
    step: deleting ? DELETE_EVERY_MS : TYPE_EVERY_MS,
  });
  const longest = Arr.reduce(topics, "", (best, text) =>
    text.length > best.length ? text : best
  );
  const [before = "", after = ""] = template.split("{topic}");

  useEffect(() => {
    if (!playing || typed !== target) {
      return;
    }
    if (deleting) {
      setDeleting(false);
      setTopic((index) => (index + 1) % topics.length);
      return;
    }
    const timer = window.setTimeout(() => setDeleting(true), HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [deleting, playing, target, topics.length, typed]);

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
          <TypedText
            caret={!shouldReduceMotion}
            className="text-primary"
            text={current}
            typed={typed}
          />
          {/* The words after the topic show once it is typed, so the question
              mark never waits at the end of letters not typed yet. */}
          <span className={typed < current.length ? "invisible" : undefined}>
            {after}
          </span>
        </span>
      </span>
    </h2>
  );
}
