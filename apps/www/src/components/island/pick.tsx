"use client";

import {
  Move01Icon,
  PackageRemoveIcon,
  RotateClockwiseIcon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Result } from "effect";
import { useTranslations } from "use-intl";
import { panelVariants } from "@/components/island/panel";
import type { Spot } from "@/components/island/store";
import { useGame } from "@/components/island/store";
import { HudTile, HudTileLabel } from "@/components/island/tile";
import { pickUp, turned } from "@/lib/island/land/build";

/**
 * What the learner does with the thing they picked up (ADR 0050, W2): move it,
 * which the next press on the land ends, turn it a quarter where it stands,
 * or take it away. Each is one step undo takes back.
 */
function PickBar({ spot }: { spot: Spot }) {
  const t = useTranslations("Island");
  const tCommon = useTranslations("Common");
  const land = useGame((state) => state.land);
  const moving = useGame((state) => state.moving);
  const setMoving = useGame((state) => state.setMoving);
  const commit = useGame((state) => state.commit);
  const select = useGame((state) => state.select);
  const setNotice = useGame((state) => state.setNotice);
  return (
    <fieldset
      aria-label={t("picked")}
      className={panelVariants({
        className:
          "sideways:col-start-2 col-start-1 row-start-3 mt-2 grid auto-cols-fr grid-flow-col gap-1 p-1",
      })}
    >
      <HudTile
        aria-pressed={moving}
        className="min-w-18"
        onClick={() => setMoving(!moving)}
        variant="ghost"
      >
        <HugeIcons icon={Move01Icon} />
        <HudTileLabel>{tCommon("move")}</HudTileLabel>
      </HudTile>
      <HudTile
        className="min-w-18"
        onClick={() =>
          Result.match(turned(land, spot), {
            onFailure: setNotice,
            onSuccess: commit,
          })
        }
        variant="ghost"
      >
        <HugeIcons icon={RotateClockwiseIcon} />
        <HudTileLabel>{t("turn-thing")}</HudTileLabel>
      </HudTile>
      <HudTile
        className="min-w-18"
        onClick={() => {
          commit(pickUp(land, spot));
          select(null);
        }}
        variant="ghost"
      >
        <HugeIcons icon={PackageRemoveIcon} />
        <HudTileLabel>{t("take")}</HudTileLabel>
      </HudTile>
    </fieldset>
  );
}

/** The small bar over the shelf while the learner holds a thing of their own world. */
export function IslandPick() {
  const spot = useGame((state) =>
    state.mode === "build" && state.host === null ? state.selected : null
  );
  return spot === null ? null : <PickBar spot={spot} />;
}
