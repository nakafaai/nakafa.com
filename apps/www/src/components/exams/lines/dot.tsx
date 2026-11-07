import { Button } from "@repo/design-system/components/ui/button";
import { cva } from "class-variance-authority";
import { Array as Arr, Option } from "effect";
import { useRef } from "react";
import { useTranslations } from "use-intl";
import { useStore } from "zustand";
import { type LineSide, useLines } from "@/components/exams/lines/context";
import {
  boardPoint,
  isPull,
  type LinePoint,
  nameOf,
} from "@/components/exams/lines/curve";

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

/** The place of one part among the dots of its side, which focus moves from: the first for a part not drawn yet. */
const indexOf = (root: HTMLElement | null, side: LineSide, id: string) =>
  Option.getOrElse(
    Arr.findFirstIndex(
      Arr.fromIterable(
        root?.querySelectorAll<HTMLElement>(`[data-line-side="${side}"]`) ?? []
      ),
      (dot) => dot.dataset.lineDot === id
    ),
    () => 0
  );

/**
 * The dot of one part. A statement's dot pulls a line, or takes the statement in hand on a press; an answer's dot
 * takes the line of the statement in hand, and a press on the answer it already holds takes that line away. The
 * arrow keys walk the dots, Delete takes a statement's line away, and Escape puts the statement down.
 */
export function LineDot({
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
