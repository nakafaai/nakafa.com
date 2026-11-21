import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import type { ReactNode } from "react";
import { createContext, use } from "react";

/**
 * The picture a scene stands on until its first frame is drawn, such as the
 * still the server draws for a MathVisual. A scene without one shows the
 * card's own surface under the spinner.
 */
const SceneStillContext = createContext<ReactNode>(null);

/** Callback invoked when the first scene inside `SceneStill` draws its first whole frame. */
const SceneDrawnContext = createContext<(() => void) | null>(null);

/** Reads the surrounding `SceneStill`'s drawn callback, when one was supplied. */
export function useNotifySceneDrawn() {
  return use(SceneDrawnContext);
}

/**
 * Gives the scenes inside it the still they show while they load, so the card
 * keeps the same picture from the server's HTML to the scene's first frame.
 */
export function SceneStill({
  children,
  onDrawn,
  still,
}: {
  children: ReactNode;
  onDrawn?: () => void;
  still: ReactNode;
}) {
  return (
    <SceneDrawnContext value={onDrawn ?? null}>
      <SceneStillContext value={still}>{children}</SceneStillContext>
    </SceneDrawnContext>
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
