"use client";

import { Nina } from "@repo/design-system/components/ui/nina";
import { useTranslations } from "use-intl";
import { useGame } from "@/components/island/store";
import { EmptyState } from "@/components/state/empty";
import { EmptyNina } from "@/components/state/nina";

/*
 * What the game shows where nothing is there yet, each with an act of Nina's
 * own: by a tent pitched for the camp before the world's first frame, holding
 * out a sheet of stickers for a guest book nobody signed, and by an empty
 * podium for a leaderboard nobody stands on.
 */

/** Nina's width on the cover, in pixels. */
const NINA = 128;

/**
 * The opening of the game: until the world's first frame is drawn the canvas
 * holds nothing, so the page's own ground covers it with Nina waiting. It
 * lies over the HUD and lifts the moment the world shows, so nothing under it
 * moves.
 */
export function IslandCover() {
  const t = useTranslations("Island");
  const shown = useGame((state) => state.shown);
  return shown ? null : (
    <div
      className="bg-background pointer-events-auto absolute inset-0 z-10 grid place-items-center"
      role="status"
    >
      <Nina act="pitching" label="" size={NINA} whole />
      <span className="sr-only">{t("opening")}</span>
    </div>
  );
}

/** The guest book of a world nobody visited yet, with the way to its first guest. */
export function GuestsBlank() {
  const t = useTranslations("Island");
  return (
    <EmptyState
      description={t("guests-empty")}
      scene={<EmptyNina act="hosting" />}
      title={t("guests-empty-title")}
    />
  );
}

/** The leaderboard before anybody stands on it. */
export function LeadersBlank() {
  const t = useTranslations("Island");
  return (
    <EmptyState
      description={t("leaders-empty")}
      scene={<EmptyNina act="ranking" />}
      title={t("leaders-empty-title")}
    />
  );
}
