"use client";

import { useMergedRef } from "@mantine/hooks";
import type { Point } from "@repo/design-system/lib/toy/flight";
import { createScatter, type Place } from "@repo/design-system/lib/toy/scatter";
import { createToys } from "@repo/design-system/lib/toy/toys";
import { cn } from "cn";
import {
  createContext,
  type ReactNode,
  type Ref,
  use,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

const ToysContext = createContext<ReturnType<typeof createToys> | null>(null);

const ScatterContext = createContext<ReturnType<typeof createScatter> | null>(
  null
);

function useToysContext() {
  const toys = use(ToysContext);
  if (toys === null) {
    throw new Error("A toy must be used within Toys");
  }
  return toys;
}

/** What a page can ask of its toys: to send one home on a spring, or to put it back at once. */
export function useToys() {
  const { home, rest } = useToysContext();
  return { home, rest };
}

/**
 * A place where anything given to a `Toy` below it can be picked up, thrown and
 * left where it lands. Its toys are positioned against it, so it is the wall
 * they stay inside unless a closer positioned parent is.
 *
 * Nothing listens until a toy is taken: the root holds one press listener, and
 * the pointer, the scroll and the frames exist only while a hand holds a toy.
 * The module carries the code of a drag, so a page that does not need its toys
 * at first paint loads it with `next/dynamic` when their part nears the screen.
 */
export function Toys({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const [toys] = useState(createToys);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (root.current) {
      return toys.attach(root.current);
    }
  }, [toys]);
  return (
    <ToysContext value={toys}>
      <div className={cn("relative", className)} ref={root}>
        {children}
      </div>
    </ToysContext>
  );
}

/**
 * A layer over the whole page for the toys below it. It covers its nearest
 * positioned parent, so a toy can be carried from the top of the page to the
 * footer and no section cuts it off. Each `Toy` below it with a `place` is put
 * where its place says, hidden when there is no room for it, and put there
 * again whenever the layout changes. The layer lets everything through but the
 * toys. Use it inside `Toys`.
 */
export function Scatter({ children }: { children: ReactNode }) {
  const { rest } = useToys();
  const [scatter] = useState(() => createScatter(rest));
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (layer.current) {
      return scatter.attach(layer.current);
    }
  }, [scatter]);
  return (
    <ScatterContext value={scatter}>
      <div className="pointer-events-none absolute inset-0 z-6" ref={layer}>
        {children}
      </div>
    </ScatterContext>
  );
}

/**
 * A toy: whatever is in it can be picked up, thrown and left where it lands. It
 * is positioned against its parent, so give it a place with `className`, or
 * below a `Scatter`, with `place`, a function of the live layout that answers
 * where it belongs at this width of the page, or nothing when there is no room.
 * Give `place` a function that keeps its identity, for a new one is a new place.
 * Until a `Scatter` has placed it, a toy is hidden.
 *
 * `onGrab` and `onRelease` tell when the toy is taken and let go, and `onDrop`
 * where the hand let go in the window, after a drag. A press that never moved
 * is a click on the toy itself, because the toy keeps the pointer while it is
 * pressed. The toy's `ref` is the element, which `useToys` sends home.
 */
export function Toy({
  children,
  className,
  onDrop,
  onGrab,
  onRelease,
  place,
  ref,
}: {
  children: ReactNode;
  className?: string;
  onDrop?: (point: Point) => void;
  onGrab?: () => void;
  onRelease?: () => void;
  place?: Place;
  ref?: Ref<HTMLDivElement>;
}) {
  const toys = useToysContext();
  const scatter = use(ScatterContext);
  const element = useRef<HTMLDivElement | null>(null);
  const merged = useMergedRef(element, ref);
  const dropped = useEffectEvent((point: Point) => onDrop?.(point));
  const grabbed = useEffectEvent(() => onGrab?.());
  const released = useEffectEvent(() => onRelease?.());

  useEffect(() => {
    if (element.current) {
      return toys.add(element.current, {
        drop: (point) => dropped(point),
        grab: () => grabbed(),
        release: () => released(),
      });
    }
  }, [toys]);

  useEffect(() => {
    if (element.current && scatter && place) {
      return scatter.add(element.current, place);
    }
  }, [place, scatter]);

  return (
    <div
      className={cn(
        "group/toy pointer-events-auto absolute z-2 cursor-grab touch-none select-none data-[held=true]:cursor-grabbing data-[held=true]:will-change-transform",
        className
      )}
      hidden={scatter !== null && place !== undefined}
      ref={merged}
    >
      <div className="transition-[scale] duration-180 ease-out group-data-[held=true]/toy:scale-108">
        {children}
      </div>
    </div>
  );
}
