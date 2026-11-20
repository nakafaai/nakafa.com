import { Button } from "@repo/design-system/components/ui/button";
import { useTranslations } from "use-intl";

/**
 * How many canvases a scene starts on before it says it failed. A browser can
 * refuse WebGL to one canvas element and still give it to a new one at the
 * same moment: Mobile Safari refused the canvas of a lab that had waited in
 * the page without a context, while a fresh canvas beside it got WebGL 2. A
 * scene that fails therefore starts again on a new element first.
 */
export const SCENE_STARTS = 3;

/**
 * What a scene's frame says once its last start failed: in words a learner
 * reads, never the browser's own error, with a way to try again.
 *
 * @param onRestart - Starts the scene again on a new canvas
 */
export function SceneFailure({ onRestart }: { onRestart: () => void }) {
  const t = useTranslations("Error");

  return (
    <div
      className="absolute inset-0 grid place-items-center p-6 text-center"
      data-slot="scene-failure"
      role="alert"
    >
      <div className="flex max-w-xs flex-col items-center gap-3">
        <p className="font-medium tracking-tight">{t("scene-title")}</p>
        <p className="text-muted-foreground text-sm">
          {t("scene-description")}
        </p>
        <Button onClick={onRestart} size="sm" variant="secondary">
          {t("retry")}
        </Button>
      </div>
    </div>
  );
}
