"use client";

import {
  getShellModelSceneColors,
  type ShellModelSample,
  type ShellModelShells,
} from "@repo/design-system/components/contents/chemistry/shell-model/data";
import { SceneSpinner } from "@repo/design-system/components/three/placeholder";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import { VisualCardScene } from "@repo/design-system/components/visual/card";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

/** The model loads once the lab asks for it, and its frame holds the place meanwhile. */
const ShellModelStage = dynamic(
  () =>
    import(
      "@repo/design-system/components/contents/chemistry/shell-model/stage"
    ).then(({ ShellModelStage }) => ShellModelStage),
  { loading: SceneSpinner }
);

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
  const { resolvedTheme } = useTheme();
  const sceneColors = getShellModelSceneColors(resolvedTheme);

  return (
    <VisualCardScene
      aria-label={ariaLabel}
      className={threeSceneFrameVariants()}
      render={<section />}
    >
      {live ? (
        <ShellModelStage
          colors={sceneColors}
          outerShellKey={outerShellKey}
          sample={sample}
          shells={shells}
        />
      ) : null}
    </VisualCardScene>
  );
}
