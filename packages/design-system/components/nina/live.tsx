import {
  useEventListener,
  useInViewport,
  useMergedRef,
  useReducedMotion,
  useTimeout,
  useWindowEvent,
} from "@mantine/hooks";
import { Frame } from "@repo/design-system/components/nina/frame";
import { marked } from "@repo/design-system/components/nina/mark";
import { paint, sameFigure } from "@repo/design-system/components/nina/paint";
import { Picture } from "@repo/design-system/components/ui/picture";
import type { MoodSchema } from "@repo/mascot/nina/face";
import { scene } from "@repo/mascot/nina/figure";
import {
  gazeAt,
  type Life,
  press,
  retarget,
  start,
  step,
  view,
} from "@repo/mascot/nina/life";
import { homeOf, modeOf, type Options } from "@repo/mascot/nina/options";
import { Array as Arr, Effect, Random } from "effect";
import { cancelFrame, type FrameData, frame } from "motion";
import {
  createContext,
  use,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";

interface LiveProps {
  label: string;
  options: Options;
  size: number;
}

/** The Nina on screen, which her picture and her life read. */
const LiveContext = createContext<LiveProps | null>(null);

/** Selects the Nina on screen from the surrounding Live. */
function useLive() {
  const live = use(LiveContext);
  if (live === null) {
    // A missing Nina is a programmer composition error at this React seam.
    throw new Error("Nina's parts require Live.");
  }
  return live;
}

/** A thing that she picks up arrives with a small pop, not from nowhere. */
const POP: Keyframe[] = [
  {
    opacity: 0,
    transform: "scale(0.9)",
    transformBox: "fill-box",
    transformOrigin: "center",
  },
  {
    opacity: 1,
    transform: "scale(1)",
    transformBox: "fill-box",
    transformOrigin: "center",
  },
];
const POP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)";

/** Her eyes close for a moment and open again. */
const BLINK: Keyframe[] = [
  {
    transform: "scaleY(1)",
    transformBox: "fill-box",
    transformOrigin: "center",
  },
  {
    transform: "scaleY(0.1)",
    transformBox: "fill-box",
    transformOrigin: "center",
  },
  {
    transform: "scaleY(1)",
    transformBox: "fill-box",
    transformOrigin: "center",
  },
];

/** Down behind the edge, a short wait, and back. She never rises above her place. */
const DUCK: Keyframe[] = [
  { easing: "cubic-bezier(0.32, 0, 0.67, 0)", transform: "translateY(0)" },
  { offset: 0.3, transform: "translateY(100%)" },
  {
    easing: "cubic-bezier(0.33, 1, 0.68, 1)",
    offset: 0.55,
    transform: "translateY(100%)",
  },
  { transform: "translateY(0)" },
];

/** Numbers from 0 up to 1 for her habits and her blinks. */
function draw() {
  return Effect.runSync(Random.next);
}

/**
 * With reduced motion she is a still picture of what she does, and a press
 * only changes her face for a moment.
 */
function Calm() {
  const { label, options, size } = useLive();
  const [glad, setGlad] = useState<typeof MoodSchema.Type>();
  const { clear, start: wait } = useTimeout(() => setGlad(undefined), 1100);
  const pressed = useEventListener("click", () => {
    clear();
    setGlad("happy");
    wait();
  });
  return (
    <Frame mode={modeOf(options)} ref={pressed}>
      <Picture
        {...scene(glad === undefined ? options : { ...options, mood: glad })}
        label={label}
        marked={marked}
        size={size}
      />
    </Frame>
  );
}

/**
 * Her life. One clock moves all of the Ninas of a page, and only while they can
 * be seen. Her limbs follow the act through springs, her eyes follow the
 * pointer, she blinks, and a press is a small surprise.
 *
 * A frame does not make React draw her again. Her picture is drawn with React
 * once, and every frame after it writes the numbers that changed straight onto
 * the elements that React made (`paint`). Only when she changes what she is
 * made of, such as a new face or a thing in her arms, is she drawn with React
 * again, in the same frame, as a new figure.
 */
function Alive() {
  const { label, options, size } = useLive();
  const [figure, setFigure] = useState(() => ({
    ...scene(options),
    version: 0,
  }));
  const root = useRef<HTMLSpanElement>(null);
  const stage = useRef<HTMLSpanElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const life = useRef<Life>(undefined);
  const shown = useRef(figure.shapes);
  const holding = useRef(false);
  const pointer = useRef<readonly [number, number]>(undefined);
  const where = useRef<DOMRect>(undefined);
  const ducking = useRef<Animation>(undefined);
  const { inViewport, ref: watch } = useInViewport<HTMLSpanElement>();
  const pressed = useEventListener("click", () => {
    if (life.current === undefined) {
      return;
    }
    const reaction = press(life.current, options);
    life.current = reaction.life;
    if (reaction.duck) {
      ducking.current?.cancel();
      ducking.current = stage.current?.animate(DUCK, { duration: 980 });
    }
  });
  const place = useMergedRef(root, watch, pressed);
  const latest = useEffectEvent(() => options);
  const home = homeOf(options);

  useWindowEvent(
    "pointermove",
    (event) => {
      pointer.current = [event.clientX, event.clientY];
    },
    { passive: true }
  );

  useEffect(() => {
    if (life.current) {
      life.current = retarget(life.current, home);
    }
  }, [home]);

  useEffect(() => {
    if (!inViewport) {
      return;
    }
    if (life.current === undefined) {
      // What she holds when her life begins is already in her picture, and
      // does not arrive with a pop.
      life.current = start(latest(), draw);
      holding.current = view(life.current, latest()).holds;
    }
    const measure = () => {
      where.current = root.current?.getBoundingClientRect();
    };
    const advance = ({ delta }: FrameData) => {
      const current = life.current;
      const at = pointer.current;
      if (current === undefined) {
        return;
      }
      const asked = latest();
      const next = step(
        current,
        asked,
        Math.min(0.05, delta / 1000 || 0.016),
        at !== undefined && where.current !== undefined
          ? gazeAt(at, where.current)
          : [0, 0],
        draw
      );
      life.current = next;
      const seen = view(next, asked);
      if (sameFigure(shown.current, seen.picture.shapes)) {
        if (svg.current) {
          paint(svg.current, shown.current, seen.picture.shapes);
        }
      } else {
        flushSync(() => {
          setFigure((before) => ({
            ...seen.picture,
            version: before.version + 1,
          }));
        });
      }
      shown.current = seen.picture.shapes;
      if (seen.holds && !holding.current) {
        svg.current
          ?.querySelector('[data-part="held"]')
          ?.animate(POP, { duration: 180, easing: POP_EASE });
      }
      holding.current = seen.holds;
    };
    frame.read(measure, true);
    frame.render(advance, true);
    return () => {
      cancelFrame(measure);
      cancelFrame(advance);
    };
  }, [inViewport]);

  useEffect(() => {
    if (!inViewport) {
      return;
    }
    let timer = 0;
    const blink = () => {
      for (const eye of Arr.fromIterable(
        svg.current?.querySelectorAll("[data-eye]") ?? []
      )) {
        eye.animate(BLINK, { duration: 160, easing: "ease-out" });
      }
      timer = window.setTimeout(blink, 2600 + draw() * 2400);
    };
    timer = window.setTimeout(blink, 1800);
    return () => window.clearTimeout(timer);
  }, [inViewport]);

  useEffect(() => () => ducking.current?.cancel(), []);

  return (
    <Frame mode={modeOf(options)} ref={place}>
      <span className="block" ref={stage}>
        <Picture
          box={figure.box}
          key={figure.version}
          label={label}
          marked={marked}
          ref={svg}
          shapes={figure.shapes}
          size={size}
        />
      </span>
    </Frame>
  );
}

/** Nina alive, or still when the person asks for less motion. */
export function Live({ label, options, size }: LiveProps) {
  const calm = useReducedMotion(undefined, { getInitialValueInEffect: false });
  const live = useMemo(
    () => ({ label, options, size }),
    [label, options, size]
  );
  return <LiveContext value={live}>{calm ? <Calm /> : <Alive />}</LiveContext>;
}
