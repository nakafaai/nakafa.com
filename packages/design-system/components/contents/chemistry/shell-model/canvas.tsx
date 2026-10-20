import { ShellModelProvider } from "@repo/design-system/components/contents/chemistry/shell-model/context";
import {
  getShellModelSceneColors,
  type ShellModelSample,
  type ShellModelShells,
} from "@repo/design-system/components/contents/chemistry/shell-model/data";
import { SceneSpinner } from "@repo/design-system/components/three/placeholder";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import { VisualCardBody } from "@repo/design-system/components/visual/card";
import { useTheme } from "@repo/design-system/providers/theme";
import { lazy, Suspense } from "react";

/** The model loads once the lab asks for it, and its frame holds the place meanwhile. */
const ShellModelStage = lazy(async () => ({
  default: await (() =>
    import(
      "@repo/design-system/components/contents/chemistry/shell-model/stage"
    ).then(({ ShellModelStage }) => ShellModelStage))(),
}));

/**
 * Renders the shared responsive 3D shell model used by chemistry shell labs.
 * Its frame is always in place; `live` mounts the model inside it.
 */
export function ShellModelCanvas({
  "aria-label": ariaLabel,
  live = true,
  outerShellKey,
  sample,
  shells,
}: {
  "aria-label": string;
  live?: boolean;
  outerShellKey: string;
  sample: ShellModelSample;
  shells: ShellModelShells;
}) {
  const resolvedTheme = useTheme((state) => state.resolvedTheme);
  const sceneColors = getShellModelSceneColors(resolvedTheme);

  return (
    <VisualCardBody
      aria-label={ariaLabel}
      className={threeSceneFrameVariants()}
      render={<section />}
    >
      {live ? (
        <ShellModelProvider
          colors={sceneColors}
          outerShellKey={outerShellKey}
          sample={sample}
          shells={shells}
        >
          <Suspense fallback={SceneSpinner()}>
            <ShellModelStage />
          </Suspense>
        </ShellModelProvider>
      ) : null}
    </VisualCardBody>
  );
}
