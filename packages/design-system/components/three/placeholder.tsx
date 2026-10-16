import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import { Spinner } from "@repo/design-system/components/ui/spinner";

/** The spinner of a scene that is still loading, centred in the frame that holds it. */
export function SceneSpinner() {
  return (
    <div aria-hidden="true" className="grid size-full place-items-center">
      <Spinner className="size-6 motion-reduce:animate-none" />
    </div>
  );
}

export function ScenePlaceholder() {
  return (
    <div
      aria-hidden="true"
      className={threeSceneFrameVariants({
        className: "grid place-items-center",
      })}
    >
      <Spinner className="size-6 motion-reduce:animate-none" />
    </div>
  );
}
