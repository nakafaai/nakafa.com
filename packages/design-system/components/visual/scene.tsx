"use client";

import {
  CenterFocusIcon,
  PauseIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  useVisual,
  VisualCardActions,
  VisualCardFullscreen,
} from "@repo/design-system/components/visual/card";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";

/**
 * Starts the scene moving by itself, or stops it. It has the look of every other
 * scene action, since a page keeps one primary button: its icon shows play or
 * pause. It is a toggle: its name stays "Play" and `aria-pressed` says whether
 * the scene plays.
 */
function VisualCardPlay() {
  const t = useTranslations("Common");
  const { playing, togglePlaying } = useVisual((state) => ({
    playing: state.playing,
    togglePlaying: state.togglePlaying,
  }));

  return (
    <Button
      aria-pressed={playing}
      onClick={togglePlaying}
      size="icon"
      variant="secondary"
    >
      <HugeIcons icon={playing ? PauseIcon : PlayIcon} />
      <span className="sr-only">{t("play")}</span>
    </Button>
  );
}

/** Takes the scene's camera back to its first view, after the learner moved it. */
function VisualCardReset() {
  const t = useTranslations("Common");
  const resetView = useVisual((state) => state.resetView);

  return (
    <Button onClick={resetView} size="icon" variant="secondary">
      <HugeIcons icon={CenterFocusIcon} />
      <span className="sr-only">{t("reset")}</span>
    </Button>
  );
}

/**
 * The actions every 3D scene has, in one band under it: play, the first view
 * back, and full screen at the end. A scene with actions of its own, such as
 * the grid of a coordinate scene, passes them as children, and they come first.
 * A static stand-in of the scene passes `inert` to the band, which makes every
 * action in it inert, so none takes focus until the scene is mounted.
 */
function VisualCardSceneActions({
  children,
  inert = false,
}: {
  children?: ReactNode;
  inert?: boolean;
}) {
  return (
    <VisualCardActions data-scene-actions="" inert={inert}>
      {children}
      <VisualCardPlay />
      <VisualCardReset />
      <VisualCardFullscreen />
    </VisualCardActions>
  );
}

export { VisualCardSceneActions };
