import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import type { ReactNode } from "react";
import { createContext, use, useMemo } from "react";

/**
 * The picture a scene stands on until its first frame is drawn, such as the
 * still the server draws for a MathVisual. A scene without one shows the
 * card's own surface under the spinner.
 */
const SceneStillContext = createContext<ReactNode>(null);

interface SceneStillCallbacks {
  readonly onDrawn: (() => void) | undefined;
  readonly onFailed: (() => void) | undefined;
  readonly onLoading: (() => void) | undefined;
}

/** Callbacks notified as a scene inside `SceneStill` draws, reloads, or falls back. */
const SceneStillCallbacksContext = createContext<SceneStillCallbacks | null>(
  null
);

/** Reads the surrounding `SceneStill`'s drawn callback, when one was supplied. */
export function useNotifySceneDrawn() {
  return use(SceneStillCallbacksContext)?.onDrawn ?? null;
}

/** Reads the surrounding `SceneStill`'s loading callback, when one was supplied. */
export function useNotifySceneLoading() {
  return use(SceneStillCallbacksContext)?.onLoading ?? null;
}

/** Reads the surrounding `SceneStill`'s fallback callback, when one was supplied. */
export function useNotifySceneFailed() {
  return use(SceneStillCallbacksContext)?.onFailed ?? null;
}

/**
 * Gives the scenes inside it the still they show while they load, so the card
 * keeps the same picture from the server's HTML to the scene's first frame,
 * and falls back to the still without an error overlay when WebGL is blocked.
 */
export function SceneStill({
  children,
  onDrawn,
  onFailed,
  onLoading,
  still,
}: {
  children: ReactNode;
  onDrawn?: () => void;
  onFailed?: () => void;
  onLoading?: () => void;
  still: ReactNode;
}) {
  const callbacks = useMemo<SceneStillCallbacks>(
    () => ({ onDrawn, onFailed, onLoading }),
    [onDrawn, onFailed, onLoading]
  );

  return (
    <SceneStillCallbacksContext value={callbacks}>
      <SceneStillContext value={still}>{children}</SceneStillContext>
    </SceneStillCallbacksContext>
  );
}

/**
 * What a scene's frame shows while its code, its assets or its first frame are
 * on their way: the scene's still when it has one, and a spinner in the middle
 * of the frame. It fills the frame that holds it, so the frame keeps its size
 * and nothing moves when the scene takes its place.
 */
export function SceneSpinner() {
  const still = use(SceneStillContext);

  return (
    <div className="absolute inset-0" data-slot="scene-loading">
      {still}
      <div
        aria-hidden="true"
        className="absolute inset-0 grid place-items-center"
      >
        <Spinner className="motion-reduce:animate-none" />
      </div>
    </div>
  );
}

/** A scene's frame, at the card's aspect, with its loading state inside. */
export function ScenePlaceholder() {
  return (
    <div className={threeSceneFrameVariants()}>
      <SceneSpinner />
    </div>
  );
}
