import { Intersection } from "@repo/design-system/components/ui/intersection";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { loadP5 } from "@repo/design-system/lib/sketch";
import { Effect, Exit } from "effect";
import type p5 from "p5";
import {
  startTransition,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslations } from "use-intl";

/**
 * A p5 sketch in instance mode: it sets `setup` and `draw` on the instance it
 * is given, and reads the card's latest state through `read` on every frame.
 */
export type P5Program<State> = (sketch: p5, read: () => State) => void;

/** The p5 class once loaded, or the message of a load that failed. */
type Loaded =
  | { readonly kind: "class"; readonly value: typeof p5 }
  | { readonly kind: "failed"; readonly message: string };

/**
 * Runs one p5 sketch inside a visual card's body. p5's modular core loads
 * with `import()` only once the card nears the screen, so no page carries it
 * in its first JavaScript. The sketch plays and pauses with the card's play
 * button, starts over when the learner resets the view, follows its box's
 * size, and is removed with the card.
 */
export function P5Sketch<State>({
  label,
  program,
  state,
}: {
  readonly label: string;
  readonly program: P5Program<State>;
  readonly state: State;
}) {
  const t = useTranslations("Error");
  const playing = useVisualScene((card) => card.playing, false);
  const view = useVisualScene((card) => card.view, 0);
  const [loaded, setLoaded] = useState<Loaded>();
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const instance = useRef<p5>(undefined);
  const latest = useRef(state);

  useLayoutEffect(() => {
    latest.current = state;
    instance.current?.redraw();
  }, [state]);

  const load = useEffectEvent(() => {
    if (loaded?.kind === "class") {
      return;
    }
    Effect.runPromiseExit(loadP5()).then((exit) =>
      startTransition(() =>
        setLoaded(
          Exit.isSuccess(exit)
            ? { kind: "class", value: exit.value }
            : { kind: "failed", message: String(exit.cause) }
        )
      )
    );
  });

  const keepPlaying = useEffectEvent((sketch: p5) => {
    if (playing) {
      sketch.loop();
    } else {
      sketch.noLoop();
    }
  });

  useEffect(() => {
    if (loaded?.kind !== "class" || !node) {
      return;
    }
    const sketch = new loaded.value(
      (each) => program(each, () => latest.current),
      node
    );
    instance.current = sketch;
    keepPlaying(sketch);
    const resize = new ResizeObserver(([entry]) => {
      if (entry) {
        sketch.resizeCanvas(entry.contentRect.width, entry.contentRect.height);
        sketch.redraw();
      }
    });
    resize.observe(node);
    return () => {
      resize.disconnect();
      sketch.remove();
      instance.current = undefined;
    };
  }, [loaded, node, program]);

  useEffect(() => {
    const sketch = instance.current;
    if (!sketch) {
      return;
    }
    if (playing) {
      sketch.loop();
    } else {
      sketch.noLoop();
    }
  }, [playing]);

  if (loaded?.kind === "failed") {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 p-4 text-center">
        <p className="font-medium tracking-tight">{t("title")}</p>
        <p className="text-muted-foreground max-w-md text-sm">
          {loaded.message}
        </p>
      </div>
    );
  }
  return (
    <Intersection
      aria-label={label}
      className="relative aspect-square w-full overflow-hidden sm:aspect-video"
      // A reset of the view mounts a new box, which starts the sketch over.
      key={view}
      once
      onIntersect={load}
      ref={setNode}
      role="img"
    />
  );
}
