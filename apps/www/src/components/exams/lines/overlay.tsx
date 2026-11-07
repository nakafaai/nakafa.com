import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cva } from "class-variance-authority";
import { Array as Arr, Option, Record as Rec } from "effect";
import { AnimatePresence, domAnimation, LazyMotion, m } from "motion/react";
import { useTranslations } from "use-intl";
import { useStore } from "zustand";
import { type LinePair, useLines } from "@/components/exams/lines/context";
import { linePath, nameOf, removePoint } from "@/components/exams/lines/curve";

/** A line's stroke, bolder while it is pointed at or its statement is in hand. */
const lineStroke = cva("stroke-primary fill-none transition-[stroke-width]", {
  variants: { lit: { false: "stroke-2", true: "stroke-3" } },
});

/** A line's remove control, shown while its line is pointed at or focused, and always on a touch screen. */
const lineRemove = cva(
  "bg-background absolute -translate-x-1/2 -translate-y-1/2 transition-opacity focus-visible:opacity-100 pointer-coarse:opacity-100",
  { variants: { lit: { false: "opacity-0", true: "opacity-100" } } }
);

/**
 * The lines of a board, under its columns, so a line shows only where it crosses the gap and every press on a part
 * reaches the part. A new line grows from its statement to its answer, a line a pull drew shows at once, and a line
 * taken away fades. Each line carries its remove control on its statement's row.
 */
export function LinesOverlay() {
  const { disabled, pairs } = useLines();

  return (
    <LazyMotion features={domAnimation} strict>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full overflow-visible"
      >
        <AnimatePresence initial={false}>
          {Arr.map(pairs, (pair) => (
            <LinePath key={`${pair.source}:${pair.target}`} pair={pair} />
          ))}
        </AnimatePresence>
        <PullPath />
      </svg>
      {disabled
        ? null
        : Arr.map(pairs, (pair) => (
            <LineRemove key={pair.source} pair={pair} />
          ))}
    </LazyMotion>
  );
}

/** One line, with a wide clear stroke over it that a pointer can rest on to show its remove control. */
function LinePath({ pair }: { readonly pair: LinePair }) {
  const { store } = useLines();
  const points = useStore(store, (state) => state.points);
  const lit = useStore(
    store,
    (state) =>
      Option.contains(state.lit, pair.source) ||
      Option.contains(state.held, pair.source)
  );
  const drawn = useStore(store, (state) =>
    Option.contains(state.drawn, pair.source)
  );
  const from = Rec.get(points, pair.source);
  const to = Rec.get(points, pair.target);
  if (Option.isNone(from) || Option.isNone(to)) {
    return null;
  }
  const path = linePath(from.value, to.value);

  return (
    <g>
      <m.path
        animate={{ opacity: 1, pathLength: 1 }}
        className={lineStroke({ lit })}
        d={path}
        exit={{ opacity: 0 }}
        initial={drawn ? false : { opacity: 1, pathLength: 0 }}
        strokeLinecap="round"
        transition={{ duration: 0.24, ease: "easeOut" }}
      />
      <path
        className="fill-none stroke-transparent"
        d={path}
        onPointerEnter={() => store.getState().light(Option.some(pair.source))}
        onPointerLeave={() => store.getState().light(Option.none())}
        pointerEvents="stroke"
        strokeWidth={16}
      />
    </g>
  );
}

/** The line a pull draws from its statement to the pointer, dashed until it lands on an answer. */
function PullPath() {
  const { store } = useLines();
  const points = useStore(store, (state) => state.points);
  const held = useStore(store, (state) => state.held);
  const tip = useStore(store, (state) => state.tip);
  const landing = useStore(store, (state) => Option.isSome(state.over));
  const from = Option.flatMap(held, (source) => Rec.get(points, source));
  if (Option.isNone(from) || Option.isNone(tip)) {
    return null;
  }

  return (
    <path
      className="stroke-primary fill-none stroke-2"
      d={linePath(from.value, tip.value)}
      strokeDasharray={landing ? undefined : "6 6"}
      strokeLinecap="round"
    />
  );
}

/** The control that takes one line away, on its statement's row, a step into the gap toward its answer. */
function LineRemove({ pair }: { readonly pair: LinePair }) {
  const t = useTranslations("Exams");
  const board = useLines();
  const { store } = board;
  const points = useStore(store, (state) => state.points);
  const lit = useStore(
    store,
    (state) =>
      Option.contains(state.lit, pair.source) ||
      Option.contains(state.held, pair.source)
  );
  const from = Rec.get(points, pair.source);
  const to = Rec.get(points, pair.target);
  const name = nameOf(board.names, pair.source);
  if (Option.isNone(from) || Option.isNone(to) || Option.isNone(name)) {
    return null;
  }
  const place = removePoint(from.value, to.value);

  return (
    <Button
      aria-label={t("line-remove", { name: name.value })}
      className={lineRemove({ lit })}
      data-line-remove={pair.source}
      onBlur={() => store.getState().light(Option.none())}
      onClick={() => {
        board.cut(pair.source);
        store.getState().light(Option.none());
      }}
      onFocus={() => store.getState().light(Option.some(pair.source))}
      onPointerEnter={() => store.getState().light(Option.some(pair.source))}
      onPointerLeave={() => store.getState().light(Option.none())}
      size="icon-sm"
      style={{ left: place.x, top: place.y }}
      type="button"
      variant="ghost"
    >
      <HugeIcons aria-hidden="true" icon={Cancel01Icon} />
    </Button>
  );
}
