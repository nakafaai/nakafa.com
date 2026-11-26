import {
  CenterFocusIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  StopIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@repo/design-system/components/ui/button-group";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  useVisual,
  VisualCardActions,
  VisualCardMenu,
} from "@repo/design-system/components/visual/card";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";

/**
 * Playback transport controls for an interactive 3D or animated visual card:
 * Play, Pause, Stop (pause and rewind without moving the camera), and Reset
 * (stop, rewind, restore controls, and return the camera to its initial view).
 */
function VisualCardTransport() {
  const t = useTranslations("Common");
  const { pause, play, playing, reset, stop } = useVisual((state) => ({
    pause: state.pause,
    play: state.play,
    playing: state.playing,
    reset: state.reset,
    stop: state.stop,
  }));

  return (
    <ButtonGroup variant="secondary">
      <Button
        aria-pressed={playing}
        disabled={playing}
        onClick={play}
        size="icon"
        tooltip={t("play")}
      >
        <HugeIcons icon={PlayIcon} />
      </Button>
      <ButtonGroupSeparator />
      <Button
        aria-pressed={!playing}
        disabled={!playing}
        onClick={pause}
        size="icon"
        tooltip={t("pause")}
      >
        <HugeIcons icon={PauseIcon} />
      </Button>
      <ButtonGroupSeparator />
      <Button onClick={stop} size="icon" tooltip={t("stop")}>
        <HugeIcons icon={StopIcon} />
      </Button>
      <ButtonGroupSeparator />
      <Button onClick={reset} size="icon" tooltip={t("reset")}>
        <HugeIcons icon={RotateCcwIcon} />
      </Button>
    </ButtonGroup>
  );
}

/** Takes the scene's camera back to its first view, after the learner moved it. */
function VisualCardReset() {
  const t = useTranslations("Common");
  const resetView = useVisual((state) => state.resetView);

  return (
    <DropdownMenuItem icon={CenterFocusIcon} onSelect={resetView}>
      {t("reset-view")}
    </DropdownMenuItem>
  );
}

/**
 * The actions every 3D scene has, in one band under it: Play, Pause, Stop, and
 * Reset transport controls on the left, then full screen joined with the menu
 * of the scene's other actions on the right, which starts with resetting the
 * camera view. A static stand-in of the scene passes `inert` to the band so
 * none of the actions take focus until the scene mounts.
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
      <VisualCardTransport />
      <VisualCardMenu>
        <VisualCardReset />
        {children}
      </VisualCardMenu>
    </VisualCardActions>
  );
}

export { VisualCardSceneActions };
