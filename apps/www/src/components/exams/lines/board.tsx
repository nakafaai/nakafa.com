import {
  useCallbackRef,
  useIsomorphicEffect,
  useWindowEvent,
} from "@mantine/hooks";
import { LineMark, MarkedLine } from "@repo/design-system/components/ui/line";
import { cva } from "class-variance-authority";
import { Array as Arr, Option, Record as Rec } from "effect";
import { type ReactNode, useRef, useState } from "react";
import { useStore } from "zustand";
import {
  type LinePair,
  type LineSide,
  LinesContext,
  useLines,
} from "@/components/exams/lines/context";
import { boardPoint, lineNames } from "@/components/exams/lines/curve";
import { LineDot } from "@/components/exams/lines/dot";
import { LinesOverlay } from "@/components/exams/lines/overlay";
import { createLines } from "@/components/exams/lines/store";
import {
  type MatchPart,
  pairedWith,
} from "@/components/exams/sitting/response";

/**
 * A board's three tracks: the statements, the gap the lines cross, and the answers. A paper leaves the lines a wide
 * gap from a tablet up and a narrow one on a phone; the key in the teacher's panel keeps the narrow one.
 */
const linesBoard = cva("relative grid min-w-0 items-start", {
  variants: {
    size: {
      key: "grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)]",
      paper:
        "grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_6rem_minmax(0,1fr)]",
    },
  },
});

/** A column of a board, drawn over the lines so its parts take the presses and the lines show only in the gap. */
const linesColumn = cva(
  "relative row-start-1 grid min-w-0 content-start gap-2",
  {
    variants: { side: { sources: "col-start-1", targets: "col-start-3" } },
  }
);

/**
 * A matching as a paper sets it, where a line joins each statement to its answer: drag a statement's dot to an
 * answer, or press the statement and then its answer, by pointer or by keyboard, and the line draws between them.
 * An answer pairs one statement, so joining it to another moves its line. Each dot's middle is measured in the
 * board's own pixels before the board paints and again whenever a column changes size, so a line always meets its
 * dots, at any width and any zoom. The canvas, the teacher's key, and the student's paper draw this one board.
 */
export function LinesProvider({
  children,
  disabled,
  match,
  onPairs,
  pairs,
  size,
  stretch,
}: {
  /** The two `LinesColumn`s, statements then answers. */
  readonly children: ReactNode;
  readonly disabled: boolean;
  readonly match: Pick<MatchPart, "sources" | "targets">;
  /** Saves the pairs after a line is drawn, moved, or taken away. */
  readonly onPairs: (pairs: readonly LinePair[]) => void;
  readonly pairs: readonly LinePair[];
  readonly size: "key" | "paper";
  /** Whether a press anywhere on a row works its dot, which a paper whose rows are written on leaves to the dot. */
  readonly stretch: boolean;
}) {
  const [store] = useState(createLines);
  const root = useRef<HTMLDivElement>(null);

  // Reads where every dot stands, in the board's own pixels, so the lines follow a zoom and a reflow alike.
  const measure = useCallbackRef(() => {
    const element = root.current;
    if (element === null) {
      return;
    }
    const box = element.getBoundingClientRect();
    store.getState().place(
      Rec.fromEntries(
        Arr.flatMap(
          Arr.fromIterable(
            element.querySelectorAll<HTMLElement>("[data-line-dot]")
          ),
          (dot) => {
            const rect = dot.getBoundingClientRect();
            return Option.match(Option.fromNullishOr(dot.dataset.lineDot), {
              onNone: () => [],
              onSome: (id) => [
                [
                  id,
                  boardPoint(
                    {
                      x: rect.left + rect.width / 2,
                      y: rect.top + rect.height / 2,
                    },
                    box,
                    element.offsetWidth
                  ),
                ] as const,
              ],
            });
          }
        )
      )
    );
  });

  // Every render may add, remove, or rewrite a part, so the dots are read again before the board paints.
  useIsomorphicEffect(() => {
    measure();
  });

  // A column grows as a part's text or picture does, and the board as its page does, so either reads the dots again.
  useIsomorphicEffect(() => {
    const element = root.current;
    if (element === null) {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    for (const list of element.querySelectorAll("ol")) {
      observer.observe(list);
    }
    return () => observer.disconnect();
  }, [measure]);

  // Escape puts down the statement in hand, wherever the focus stands.
  useWindowEvent("keydown", (event) => {
    if (event.key === "Escape" && Option.isSome(store.getState().held)) {
      store.getState().release(Option.none());
    }
  });

  return (
    <LinesContext
      value={{
        connect: (source, target) =>
          onPairs(pairedWith(match.sources, pairs, { source, target })),
        cut: (source) =>
          onPairs(Arr.filter(pairs, (pair) => pair.source !== source)),
        disabled,
        names: lineNames(match),
        pairs,
        root,
        store,
        stretch,
      }}
    >
      <div className={linesBoard({ size })} data-lines="" ref={root}>
        <LinesOverlay />
        {children}
      </div>
    </LinesContext>
  );
}

/** One column of a board: its parts, and what stands under them, such as the action that adds a part. */
export function LinesColumn({
  children,
  footer,
  side,
}: {
  /** The column's `LinesItem`s. */
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly side: LineSide;
}) {
  return (
    <div className={linesColumn({ side })}>
      <ol className="grid min-w-0 content-start gap-2">{children}</ol>
      {footer}
    </div>
  );
}

/**
 * One part of a board: its outlined row, the number or letter that names it with its words, and its dot outside the
 * row on the side that faces the other column, so a line leaves the dot in the open and touches no outline. The row
 * reads chosen while its statement is in hand or a pull hovers its answer, and an answer's whole part takes a pull's
 * release. The caller composes the row's words (`LineWords`) and anything at its end, such as a remove control.
 */
export function LinesItem({
  children,
  id,
  name,
  side,
}: {
  readonly children: ReactNode;
  readonly id: string;
  readonly name: string;
  readonly side: LineSide;
}) {
  const { store, stretch } = useLines();
  const marked = useStore(store, (state) =>
    side === "sources"
      ? Option.contains(state.held, id)
      : Option.contains(state.over, id)
  );

  return (
    <li
      className="relative flex min-w-0 items-start gap-2"
      data-line-target={side === "targets" ? id : undefined}
    >
      {side === "targets" ? (
        <LineMark>
          <LineDot id={id} name={name} side={side} />
        </LineMark>
      ) : null}
      <MarkedLine tone={marked ? "chosen" : "idle"} written={!stretch}>
        <LineMark letter>{name}.</LineMark>
        {children}
      </MarkedLine>
      {side === "sources" ? (
        <LineMark>
          <LineDot id={id} name={name} side={side} />
        </LineMark>
      ) : null}
    </li>
  );
}
