"use client";

import {
  useEventListener,
  useInViewport,
  useMergedRef,
  usePrevious,
  useReducedMotion,
  useTimeout,
  useWindowEvent,
} from "@mantine/hooks";
import { Picture } from "@repo/design-system/components/nina/draw";
import type { MoodSchema } from "@repo/design-system/components/nina/face";
import {
  type Options,
  scene,
} from "@repo/design-system/components/nina/figure";
import { Frame } from "@repo/design-system/components/nina/frame";
import {
  gazeAt,
  holding,
  view,
} from "@repo/design-system/components/nina/live";
import { homeOf, modeOf } from "@repo/design-system/components/nina/mode";
import { createLifeStore } from "@repo/design-system/components/nina/store";
import { Array as Arr, Effect, Random } from "effect";
import { cancelFrame, type FrameData, frame } from "motion";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useStore } from "zustand";

type LiveProps = {
  label: string;
  options: Options;
  size: number;
};

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
function Calm({ label, options, size }: LiveProps) {
  const [glad, setGlad] = useState<typeof MoodSchema.Type>();
  const { clear, start } = useTimeout(() => setGlad(undefined), 1100);
  const press = useEventListener("click", () => {
    clear();
    setGlad("senang");
    start();
  });
  return (
    <Frame edge={modeOf(options) === "peek"} ref={press}>
      <Picture
        {...scene(glad === undefined ? options : { ...options, mood: glad })}
        label={label}
        size={size}
      />
    </Frame>
  );
}

/**
 * Her life. One clock moves all of the Ninas of a page, and only while they can
 * be seen. Her limbs follow the act through springs, her eyes follow the
 * pointer, she blinks, and a press is a small surprise.
 */
function Alive({ label, options, size }: LiveProps) {
  const [store] = useState(() => createLifeStore(draw));
  const live = useStore(store, (state) => state.live);
  const root = useRef<HTMLSpanElement>(null);
  const stage = useRef<HTMLSpanElement>(null);
  const pointer = useRef<readonly [number, number]>(undefined);
  const ducking = useRef<Animation>(undefined);
  const { inViewport, ref: watch } = useInViewport<HTMLSpanElement>();
  const press = useEventListener("click", () => {
    if (store.getState().press(options)) {
      ducking.current?.cancel();
      ducking.current = stage.current?.animate(DUCK, { duration: 980 });
    }
  });
  const place = useMergedRef(root, watch, press);
  const latest = useEffectEvent(() => options);
  const home = homeOf(options);
  const holds = live !== undefined && holding(live);
  const held = usePrevious(holds);

  useWindowEvent(
    "pointermove",
    (event) => {
      pointer.current = [event.clientX, event.clientY];
    },
    { passive: true }
  );

  useEffect(() => {
    store.getState().begin(latest());
  }, [store]);

  useEffect(() => {
    store.getState().retarget(home);
  }, [home, store]);

  useEffect(() => {
    if (!inViewport) {
      return;
    }
    let before = performance.now();
    const tick = ({ timestamp }: FrameData) => {
      const box = root.current?.getBoundingClientRect();
      const at = pointer.current;
      store
        .getState()
        .tick(
          latest(),
          Math.min(0.05, (timestamp - before) / 1000 || 0.016),
          at !== undefined && box !== undefined ? gazeAt(at, box) : [0, 0]
        );
      before = timestamp;
    };
    frame.update(tick, true);
    return () => cancelFrame(tick);
  }, [inViewport, store]);

  useEffect(() => {
    if (!inViewport) {
      return;
    }
    let timer = 0;
    const blink = () => {
      for (const eye of Arr.fromIterable(
        root.current?.querySelectorAll("[data-eye]") ?? []
      )) {
        eye.animate(BLINK, { duration: 160, easing: "ease-out" });
      }
      timer = window.setTimeout(blink, 2600 + draw() * 2400);
    };
    timer = window.setTimeout(blink, 1800);
    return () => window.clearTimeout(timer);
  }, [inViewport]);

  useEffect(() => {
    if (holds && held === false) {
      root.current
        ?.querySelector('[data-part="held"]')
        ?.animate(POP, { duration: 180, easing: POP_EASE });
    }
  }, [held, holds]);

  useEffect(() => () => ducking.current?.cancel(), []);

  return (
    <Frame edge={modeOf(options) === "peek"} ref={place}>
      <span className="block" ref={stage}>
        <Picture
          {...(live === undefined ? scene(options) : view(live, options))}
          label={label}
          size={size}
        />
      </span>
    </Frame>
  );
}

/** Nina alive, or still when the person asks for less motion. */
export function Live(props: LiveProps) {
  const calm = useReducedMotion(undefined, { getInitialValueInEffect: false });
  return calm ? <Calm {...props} /> : <Alive {...props} />;
}
