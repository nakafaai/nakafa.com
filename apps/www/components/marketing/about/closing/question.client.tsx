"use client";

import { useIntersection, useReducedMotion } from "@mantine/hooks";
import { Array as Arr } from "effect";
import { useEffect, useState } from "react";

/** The time between two letters of the topic that is being typed. */
const TYPE_EVERY_MS = 90;

/** How long a finished topic stays on the page before the next one is typed. */
const HOLD_MS = 2400;

interface ClosingQuestionProps {
  /** The question as the locale words it, with `{topic}` where the topic goes. */
  readonly template: string;
  /** The topics that take turns in the question. The first one is the one it rests on. */
  readonly topics: Arr.NonEmptyReadonlyArray<string>;
}

/**
 * The closing question, with one of its topics typed in place of the placeholder.
 * The space of the longest topic is kept, so typing never moves the words around
 * it. The topics take turns while the question is on screen. With reduced motion
 * the question rests on its first topic.
 */
export function ClosingQuestion({ template, topics }: ClosingQuestionProps) {
  const { entry, ref } = useIntersection({ threshold: 0.5 });
  const shouldReduceMotion = useReducedMotion();
  const [topic, setTopic] = useState(0);
  const [typed, setTyped] = useState(0);
  const playing = (entry?.isIntersecting ?? false) && !shouldReduceMotion;
  const current = topics[topic % topics.length];
  const shown = shouldReduceMotion ? topics[0] : current.slice(0, typed);
  const longest = Arr.reduce(topics, "", (best, text) =>
    text.length > best.length ? text : best
  );
  const [before = "", after = ""] = template.split("{topic}");

  useEffect(() => {
    if (!playing) {
      return;
    }
    const topicText = topics[topic % topics.length];
    const finished = typed >= topicText.length;
    const timer = window.setTimeout(
      () => {
        if (finished) {
          setTopic((index) => (index + 1) % topics.length);
          setTyped(0);
          return;
        }
        setTyped((count) => count + 1);
      },
      finished ? HOLD_MS : TYPE_EVERY_MS
    );
    return () => window.clearTimeout(timer);
  }, [playing, topic, topics, typed]);

  return (
    <h2 className="text-balance text-3xl tracking-tight sm:text-4xl" ref={ref}>
      {before}
      <span className="inline-grid">
        <span className="col-start-1 row-start-1">{shown}</span>
        <span aria-hidden="true" className="invisible col-start-1 row-start-1">
          {longest}
        </span>
      </span>
      {after}
    </h2>
  );
}
