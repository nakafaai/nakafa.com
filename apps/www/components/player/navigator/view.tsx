"use client";

import {
  LeftToRightListDashIcon,
  SquareIcon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { Effect, Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import { usePlayer, usePlayerView } from "@/components/player/context";
import {
  BrowserPlayerModeWriterLive,
  PlayerModeSchema,
  persistPlayerMode,
} from "@/components/player/mode";
import { reportClientException } from "@/lib/analytics/client";

const decodeMode = Schema.decodeUnknownOption(PlayerModeSchema);

/**
 * Switches between the list and one question at a time. The switch is
 * instant; the cookie and URL follow so the server renders the same view.
 * Hidden when the assessment locks the mode.
 */
export function PlayerViewToggle() {
  const t = useTranslations("Player");
  const lock = usePlayer((session) => session.meta.lock);
  const mode = usePlayerView((view) => view.mode);
  const setMode = usePlayerView((view) => view.setMode);
  if (lock) {
    return null;
  }

  /** Applies a newly pressed item; re-pressing the current one is ignored. */
  function onValueChange(value: string) {
    const next = decodeMode(value);
    if (Option.isNone(next)) {
      return;
    }
    setMode(next.value);
    Effect.runFork(
      persistPlayerMode(next.value).pipe(
        Effect.provide(BrowserPlayerModeWriterLive),
        Effect.catchTag("PlayerModePersistenceError", (error) =>
          reportClientException(error, { source: "player-view" })
        )
      )
    );
  }

  return (
    <ToggleGroup
      aria-label={t("mode")}
      gridColumns="2"
      onValueChange={onValueChange}
      type="single"
      value={mode}
      variant="outline"
    >
      <ToggleGroupItem value="list">
        <HugeIcons icon={LeftToRightListDashIcon} />
        {t("mode-list")}
      </ToggleGroupItem>
      <ToggleGroupItem value="single">
        <HugeIcons icon={SquareIcon} />
        {t("mode-single")}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
