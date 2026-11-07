import {
  useCallbackRef,
  useIsomorphicEffect,
  useWindowEvent,
} from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import { cva } from "class-variance-authority";
import { Array as Arr, Option, Record as Rec } from "effect";
import { type ReactNode, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { useStore } from "zustand";
import {
  type LinePair,
  LinesContext,
  useLines,
} from "@/components/exams/lines/context";
import {
  boardPoint,
  isPull,
  type LinePoint,
  lineNames,
  nameOf,
} from "@/components/exams/lines/curve";
import { LinesOverlay } from "@/components/exams/lines/overlay";
import { createLines } from "@/components/exams/lines/store";
import {
  type MatchPart,
  pairedWith,
} from "@/components/exams/sitting/response";

/** One side of a board: its statements or its answers. */
type LineSide = "sources" | "targets";

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

/** One part's row, ringed while it is in hand or under a pull. */
const linesItem = cva(
  "relative flex min-h-10 min-w-0 items-center gap-2 rounded-lg px-2 py-1",
  {
    variants: {
      marked: { false: "", true: "ring-primary ring-2" },
    },
  }
);

/** A dot's hit area: a press anywhere on its row works it on a paper no one writes on. */
const lineDot = cva("shrink-0 touch-pan-y", {
  variants: {
    stretch: { false: "", true: "static after:absolute after:inset-0" },
  },
});

/** The mark inside a dot: open, joined by a line, or in hand. */
const dotMark = cva("size-3 rounded-full border-2 transition-colors", {
  variants: {
    state: {
      held: "border-primary bg-background ring-primary/30 ring-4",
      joined: "border-primary bg-primary",
      open: "border-muted-foreground bg-background",
      ready: "border-primary bg-background",
    },
  },
});

/** How a dot reads: in hand, joined by a line, waiting for the statement in hand, or open. */
const dotState = (held: boolean, joined: boolean, ready: boolean) => {
  if (held) {
    return "held";
  }
  if (joined) {
    return "joined";
  }
  return ready ? "ready" : "open";
};

/** The answer under a point of the screen on one board, by its row, or none. */
const targetAt = (root: HTMLElement, x: number, y: number) => {
  const row = document
    .elementFromPoint(x, y)
    ?.closest<HTMLElement>("[data-line-target]");
  return Option.fromNullishOr(
    row !== null && row !== undefined && root.contains(row)
      ? row.dataset.lineTarget
      : undefined
  );
};

/** Moves the focus to one dot of a side of a board, the last one when the index runs past it. */
const focusDot = (root: HTMLElement | null, side: LineSide, index: number) => {
  const dots = Arr.fromIterable(
    root?.querySelectorAll<HTMLButtonElement>(`[data-line-side="${side}"]`) ??
      []
  );
  Option.map(
    Arr.get(dots, Math.min(Math.max(index, 0), dots.length - 1)),
    (dot) => dot.focus()
  );
};

/** The place of one part among the dots of its side. */
const indexOf = (root: HTMLElement | null, side: LineSide, id: string) =>
  Arr.findFirstIndex(
    Arr.fromIterable(
      root?.querySelectorAll<HTMLElement>(`[data-line-side="${side}"]`) ?? []
    ),
    (dot) => dot.dataset.lineDot === id
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
      <div className={linesBoard({ size })} ref={root}>
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
 * One part of a board: its number or letter and its text, with its dot on the side that faces the other column.
 * An answer's whole row takes a pull's release, and a part ringed is in hand or under a pull.
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
  const { store } = useLines();
  const marked = useStore(store, (state) =>
    side === "sources"
      ? Option.contains(state.held, id)
      : Option.contains(state.over, id)
  );

  return (
    <li
      className={linesItem({ marked })}
      data-line-target={side === "targets" ? id : undefined}
    >
      {side === "targets" ? <LineDot id={id} name={name} side={side} /> : null}
      <span className="shrink-0 font-medium tabular-nums">{name}.</span>
      <div className="min-w-0 flex-1">{children}</div>
      {side === "sources" ? <LineDot id={id} name={name} side={side} /> : null}
    </li>
  );
}

/**
 * The dot of one part. A statement's dot pulls a line, or takes the statement in hand on a press; an answer's dot
 * takes the line of the statement in hand, and a press on the answer it already holds takes that line away. The
 * arrow keys walk the dots, Delete takes a statement's line away, and Escape puts the statement down.
 */
function LineDot({
  id,
  name,
  side,
}: {
  readonly id: string;
  readonly name: string;
  readonly side: LineSide;
}) {
  const t = useTranslations("Exams");
  const board = useLines();
  const { root, store } = board;
  const held = useStore(store, (state) => Option.contains(state.held, id));
  const ready = useStore(
    store,
    (state) => side === "targets" && Option.isSome(state.held)
  );
  const pair = Arr.findFirst(board.pairs, (item) =>
    side === "sources" ? item.source === id : item.target === id
  );
  // Where the pointer pressed, while it is down on a statement's dot, and whether it has moved into a pull.
  const press = useRef<LinePoint | null>(null);
  const pulled = useRef(false);

  /** Takes the line of the statement in hand to this answer, or away when it reaches this answer already. */
  const answer = (byKey: boolean) =>
    Option.map(store.getState().held, (source) => {
      if (Option.exists(pair, (item) => item.source === source)) {
        board.cut(source);
      } else {
        board.connect(source, id);
      }
      store.getState().release(Option.none());
      if (byKey) {
        focusDot(
          root.current,
          "sources",
          indexOf(root.current, "sources", source) + 1
        );
      }
    });

  return (
    <Button
      aria-label={
        side === "targets"
          ? t("line-answer", { name })
          : Option.match(
              Option.flatMap(pair, (item) => nameOf(board.names, item.target)),
              {
                onNone: () => t("line-statement", { name }),
                onSome: (answerName) =>
                  t("line-statement-joined", { answer: answerName, name }),
              }
            )
      }
      aria-pressed={side === "sources" ? held : undefined}
      className={lineDot({ stretch: board.stretch })}
      data-line-dot={id}
      data-line-side={side}
      disabled={board.disabled}
      onBlur={() => store.getState().light(Option.none())}
      onClick={(event) => {
        if (pulled.current) {
          pulled.current = false;
          return;
        }
        const byKey = event.detail === 0;
        if (side === "targets") {
          answer(byKey);
          return;
        }
        store.getState().take(id);
        if (byKey && Option.isSome(store.getState().held)) {
          focusDot(
            root.current,
            "targets",
            Option.match(pair, {
              onNone: () => 0,
              onSome: (item) => indexOf(root.current, "targets", item.target),
            })
          );
        }
      }}
      onFocus={() =>
        store
          .getState()
          .light(
            side === "sources"
              ? Option.some(id)
              : Option.map(pair, (item) => item.source)
          )
      }
      onKeyDown={(event) => {
        const here = indexOf(root.current, side, id);
        const other = side === "sources" ? "targets" : "sources";
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          focusDot(
            root.current,
            side,
            here + (event.key === "ArrowDown" ? 1 : -1)
          );
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          focusDot(root.current, other, here);
        }
        if (
          side === "sources" &&
          (event.key === "Delete" || event.key === "Backspace") &&
          Option.isSome(pair)
        ) {
          event.preventDefault();
          board.cut(id);
        }
      }}
      onLostPointerCapture={() => {
        if (press.current !== null && pulled.current) {
          store.getState().release(Option.none());
        }
        press.current = null;
      }}
      onPointerDown={(event) => {
        if (side !== "sources" || event.button !== 0) {
          return;
        }
        press.current = { x: event.clientX, y: event.clientY };
        pulled.current = false;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerEnter={() =>
        store
          .getState()
          .light(
            side === "sources"
              ? Option.some(id)
              : Option.map(pair, (item) => item.source)
          )
      }
      onPointerLeave={() => store.getState().light(Option.none())}
      onPointerMove={(event) => {
        const element = root.current;
        const point = { x: event.clientX, y: event.clientY };
        if (press.current === null || element === null) {
          return;
        }
        if (!(pulled.current || isPull(press.current, point))) {
          return;
        }
        pulled.current = true;
        store
          .getState()
          .pull(
            id,
            boardPoint(
              point,
              element.getBoundingClientRect(),
              element.offsetWidth
            ),
            targetAt(element, point.x, point.y)
          );
      }}
      onPointerUp={(event) => {
        const element = root.current;
        if (press.current === null || element === null) {
          return;
        }
        press.current = null;
        if (!pulled.current) {
          return;
        }
        const target = targetAt(element, event.clientX, event.clientY);
        Option.map(target, (found) => board.connect(id, found));
        store
          .getState()
          .release(Option.isSome(target) ? Option.some(id) : Option.none());
      }}
      size="icon-sm"
      type="button"
      variant="ghost"
    >
      <span
        className={dotMark({
          state: dotState(held, Option.isSome(pair), ready),
        })}
      />
    </Button>
  );
}
