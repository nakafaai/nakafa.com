import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import { Spinner } from "@repo/design-system/components/ui/spinner";

export function ScenePlaceholder() {
  return (
    <div
      aria-hidden="true"
      className={threeSceneFrameVariants({
        className: "grid place-items-center",
      })}
    >
      <Spinner className="size-6" />
    </div>
  );
}
