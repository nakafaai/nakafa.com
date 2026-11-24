import {
  useDocumentVisibility,
  useEventListener,
  useInViewport,
  useMergedRef,
  useReducedMotion,
  useTimeout,
  useWindowEvent,
} from "@mantine/hooks";
import {
  BLINK_DURATION,
  blinkScale,
  drawFrame,
  POP_DURATION,
  popProgress,
  readPalette,
} from "@repo/design-system/components/nina/canvas";
import { createCache } from "@repo/design-system/components/nina/draw";
import { Frame } from "@repo/design-system/components/nina/frame";
import { marked } from "@repo/design-system/components/nina/mark";
import { Picture } from "@repo/design-system/components/ui/picture";
import { usePageSettled } from "@repo/design-system/components/ui/settled";
import { useRequired } from "@repo/design-system/hooks/required";
import { createFramePace } from "@repo/design-system/lib/pace";
import { pictureHeight } from "@repo/design-system/lib/picture";
import { HALF_BOX, WHOLE_BOX } from "@repo/mascot/nina/box";
import type { MoodSchema } from "@repo/mascot/nina/face";
import { scene } from "@repo/mascot/nina/figure";
import type { Life } from "@repo/mascot/nina/life";
import {
  frame as frameOf,
  gazeAt,
  isStill,
  press,
  retarget,
  start,
  step,
} from "@repo/mascot/nina/life";
import type { Options } from "@repo/mascot/nina/options";
import { homeOf, modeOf } from "@repo/mascot/nina/options";
import { Effect, Random } from "effect";
import type { FrameData } from "motion";
import { cancelFrame, frame } from "motion";
import {
  createContext,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface LiveProps {
  label: string;
  options: Options;
  size: number;
}

/** Caps backing store DPR at 3 so high-DPI screens stay razor-sharp without unbounded memory. */
const MAX_DPR = 3;

/** The Nina on screen, which her picture and her life read. */
const LiveContext = createContext<LiveProps | null>(null);

/** Selects the Nina on screen from the surrounding Live. */
function useLive() {
  return useRequired(LiveContext, "useLive");
}

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
 * Her live Canvas 2D life. The server draws her first paint as a static SVG;
 * once awakened in the viewport on a settled, visible page, she renders onto a
 * native-DPR 2D canvas without per-frame SVG DOM mutations or React re-renders.
 *
 * A tile sleeps at 0% CPU whenever her eyes have reached the pointer and no
 * blink or click reaction is playing, waking immediately on pointer movement,
 * press, theme change, or her next blink.
 */
function Alive() {
  const { label, options, size } = useLive();
  const mode = modeOf(options);
  const box = options.whole === true ? WHOLE_BOX : HALF_BOX;
  const height = pictureHeight(size, box);
  const named = label !== "";

  const root = useRef<HTMLSpanElement>(null);
  const stage = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const ctx = useRef<CanvasRenderingContext2D | null>(null);
  const palette = useRef<ReturnType<typeof readPalette>>(undefined);
  const cache = useRef<ReturnType<typeof createCache>>(undefined);
  const life = useRef<Life>(undefined);
  const holding = useRef(false);
  const pointer = useRef<readonly [number, number]>(undefined);
  const where = useRef<DOMRect>(undefined);
  const rectDirty = useRef(true);
  const ducking = useRef<Animation>(undefined);
  const blinkStart = useRef(-BLINK_DURATION);
  const popStart = useRef(-POP_DURATION);
  const wakeLoop = useRef<() => void>(undefined);

  const { inViewport, ref: watch } = useInViewport<HTMLSpanElement>();
  const settled = usePageSettled();
  const visibility = useDocumentVisibility();
  const living = inViewport && settled && visibility === "visible";
  const latest = useEffectEvent(() => options);
  const home = homeOf(options);

  const renderNow = useCallback(
    (now: number, current: Life, asked: Options) => {
      const element = canvas.current;
      const context = ctx.current;
      if (element === null || context === null) {
        return false;
      }
      if (palette.current === undefined) {
        palette.current = readPalette(element);
      }
      if (cache.current === undefined) {
        cache.current = createCache();
      }
      const snapshot = frameOf(current, asked);
      if (snapshot.holds && !holding.current) {
        popStart.current = now;
      }
      holding.current = snapshot.holds;
      drawFrame(
        context,
        snapshot,
        palette.current,
        cache.current,
        {
          eyeScaleY: blinkScale(now - blinkStart.current),
          heldPop: popProgress(now - popStart.current),
        },
        element.width,
        element.height
      );
      return true;
    },
    []
  );

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
    wakeLoop.current?.();
  });

  const place = useMergedRef(root, watch, pressed);

  useWindowEvent(
    "pointermove",
    (event) => {
      pointer.current = [event.clientX, event.clientY];
      wakeLoop.current?.();
    },
    { passive: true }
  );

  useWindowEvent(
    "scroll",
    () => {
      rectDirty.current = true;
    },
    { capture: true, passive: true }
  );

  useWindowEvent(
    "resize",
    () => {
      rectDirty.current = true;
    },
    { passive: true }
  );

  // Sync backing store dimensions and paint the initial frame synchronously before first canvas paint.
  useLayoutEffect(() => {
    const element = canvas.current;
    if (element === null) {
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const nextWidth = Math.max(1, Math.round(size * dpr));
    const nextHeight = Math.max(1, Math.round(height * dpr));
    if (element.width !== nextWidth || element.height !== nextHeight) {
      element.width = nextWidth;
      element.height = nextHeight;
    }
    if (ctx.current === null) {
      ctx.current = element.getContext("2d");
    }
    if (life.current === undefined) {
      life.current = start(latest(), draw);
      holding.current = frameOf(life.current, latest()).holds;
    }
    palette.current = readPalette(element);
    renderNow(performance.now(), life.current, latest());
  }, [height, renderNow, size]);

  // Refresh resolved CSS tokens when the document theme changes.
  useEffect(() => {
    const element = canvas.current;
    if (element === null) {
      return;
    }
    const observer = new MutationObserver(() => {
      palette.current = readPalette(element);
      if (life.current !== undefined) {
        renderNow(performance.now(), life.current, latest());
      }
    });
    observer.observe(document.documentElement, {
      attributeFilter: ["class", "data-theme", "style"],
      attributes: true,
    });
    return () => observer.disconnect();
  }, [renderNow]);

  useEffect(() => {
    if (life.current) {
      life.current = retarget(life.current, home);
      wakeLoop.current?.();
    }
  }, [home]);

  useEffect(() => {
    if (!living) {
      return;
    }
    if (life.current === undefined) {
      life.current = start(latest(), draw);
      holding.current = frameOf(life.current, latest()).holds;
    }
    const pace = createFramePace();
    let waited = 0;
    let running = false;

    const stopLoop = () => {
      if (!running) {
        return;
      }
      running = false;
      cancelFrame(measure);
      cancelFrame(advance);
    };

    const startLoop = () => {
      if (running) {
        return;
      }
      running = true;
      waited = 0;
      frame.read(measure, true);
      frame.render(advance, true);
    };

    const measure = () => {
      if (
        pointer.current !== undefined &&
        rectDirty.current &&
        pace.isDue(performance.now())
      ) {
        where.current = root.current?.getBoundingClientRect();
        rectDirty.current = false;
      }
    };

    const advance = ({ delta }: FrameData) => {
      const current = life.current;
      const at = pointer.current;
      const startedAt = performance.now();
      waited += delta;
      if (current === undefined || !pace.isDue(startedAt)) {
        return;
      }
      const asked = latest();
      const target =
        at !== undefined && where.current !== undefined
          ? gazeAt(at, where.current)
          : ([0, 0] as const);
      const next = step(
        current,
        asked,
        Math.min(0.05, waited / 1000 || 0.016),
        target,
        draw
      );
      life.current = next;
      renderNow(startedAt, next, asked);
      waited = 0;
      const animatingEffect =
        startedAt - blinkStart.current < BLINK_DURATION ||
        startedAt - popStart.current < POP_DURATION;
      if (!animatingEffect && isStill(next, asked, target)) {
        stopLoop();
        return;
      }
      pace.rest(startedAt);
    };

    wakeLoop.current = startLoop;
    startLoop();
    return () => {
      wakeLoop.current = undefined;
      stopLoop();
      pace.stop();
    };
  }, [living, renderNow]);

  useEffect(() => {
    if (!living) {
      return;
    }
    let timer = 0;
    const blink = () => {
      blinkStart.current = performance.now();
      wakeLoop.current?.();
      timer = window.setTimeout(blink, 2600 + draw() * 2400);
    };
    timer = window.setTimeout(blink, 1800);
    return () => window.clearTimeout(timer);
  }, [living]);

  useEffect(() => () => ducking.current?.cancel(), []);

  return (
    <Frame mode={mode} ref={place}>
      <span className="block" ref={stage}>
        <canvas
          aria-hidden={named ? undefined : true}
          aria-label={named ? label : undefined}
          className="block"
          ref={canvas}
          role={named ? "img" : undefined}
          style={{ height, width: size }}
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
