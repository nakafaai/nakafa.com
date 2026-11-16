import {
  useElementSize,
  useInViewport,
  useMergedRef,
  useReducedMotion,
} from "@mantine/hooks";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Array as Arr } from "effect";
import { type AnimationSequence, animate } from "motion";
import { type ReactNode, type Ref, useEffect, useRef } from "react";
import {
  type Point,
  type Size,
  type Wire,
  wirePath,
} from "@/components/marketing/school/flow/wire";

/** The seconds a picture rests on its last moment before it plays again. */
const REST = 1.4;

/**
 * Plays a stage's story while a reader can see it, again and again, and keeps
 * it still for a reader who asked for less motion. `compose` writes the story
 * for the stage's size in pixels, which a thing that travels a wire needs, so
 * the story is written again when the stage changes size. The ref goes on the
 * stage.
 */
export function useFlowPlay(
  compose: (stage: HTMLElement, size: typeof Size.Type) => AnimationSequence
) {
  const stage = useRef<HTMLDivElement>(null);
  const { inViewport, ref: seen } = useInViewport<HTMLDivElement>();
  const { height, ref: sized, width } = useElementSize<HTMLDivElement>();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const element = stage.current;
    if (element === null || !inViewport || shouldReduceMotion || width === 0) {
      return;
    }
    const controls = animate(compose(element, { height, width }), {
      repeat: Number.POSITIVE_INFINITY,
      repeatDelay: REST,
    });
    return () => controls.cancel();
  }, [compose, height, inViewport, shouldReduceMotion, width]);

  return useMergedRef(stage, seen, sized);
}

/**
 * The stage of one picture of the School landing: a box of one shape in which
 * mascots, cards and the wires between them stand at places counted in
 * hundredths of its width and height, so the picture is whole in the first
 * HTML and keeps its proportions at every width. A screen reader hears `label`
 * in place of the picture.
 */
export function FlowStage({
  children,
  className,
  label,
  ref,
}: {
  children: ReactNode;
  className?: string;
  label: string;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      aria-label={label}
      className={cn("relative mx-auto w-full", className)}
      ref={ref}
      role="img"
    >
      {children}
    </div>
  );
}

/** The wires of a stage, drawn under everything that stands on it. Each wire is named, so a story can light it. */
export function FlowWires({
  wires,
}: {
  wires: readonly { name: string; path: Wire }[];
}) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
      fill="none"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      {Arr.map(wires, ({ name, path }) => (
        <g key={name}>
          <path
            className="stroke-border"
            d={wirePath(path)}
            strokeLinecap="round"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
          <path
            className="stroke-primary opacity-0"
            d={wirePath(path)}
            data-wire={name}
            strokeLinecap="round"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
    </svg>
  );
}

const nodeVariants = cva("absolute -translate-x-1/2", {
  defaultVariants: { anchor: "top" },
  variants: {
    anchor: {
      bottom: "-translate-y-full",
      middle: "-translate-y-1/2",
      top: "",
    },
  },
});

/**
 * What stands at one place of a stage: its middle is on the place, and
 * `anchor` says whether its top, its middle or its bottom touches it, which is
 * where its wires end. `tall` gives it a height in hundredths of the stage's,
 * for a figure whose wires leave from its bottom too.
 */
export function FlowNode({
  anchor,
  at,
  children,
  tall,
}: {
  at: Point;
  children: ReactNode;
  tall?: number;
} & VariantProps<typeof nodeVariants>) {
  return (
    <div
      className={nodeVariants({ anchor })}
      style={{
        height: tall === undefined ? undefined : `${tall}%`,
        left: `${at.x}%`,
        top: `${at.y}%`,
      }}
    >
      {children}
    </div>
  );
}

/** A small round light that travels a wire, for what carries no picture of its own. */
export function FlowDot() {
  return <div className="bg-foreground size-2 rounded-full" />;
}

/**
 * A thing that travels the wires of a stage. It waits unseen at the stage's
 * top left corner, its middle on the corner, and a story moves it by the
 * offsets of a wire's way and shows it while it is under way.
 */
export function FlowParcel({
  children,
  name,
}: {
  children: ReactNode;
  name: string;
}) {
  return (
    <div
      className="pointer-events-none absolute top-0 left-0 opacity-0"
      data-parcel={name}
    >
      <div className="-translate-x-1/2 -translate-y-1/2">{children}</div>
    </div>
  );
}
