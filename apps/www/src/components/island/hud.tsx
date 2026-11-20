"use client";

import { cva } from "class-variance-authority";
import { IslandCover } from "@/components/island/blank";
import { BoardSheet } from "@/components/island/board";
import { IslandDock } from "@/components/island/dock";
import { GuideSheet } from "@/components/island/guide";
import { IslandNotices } from "@/components/island/notice";
import { IslandPick } from "@/components/island/pick";
import { ShareSheet } from "@/components/island/share";
import { MapSheet } from "@/components/island/sheet";
import { IslandShelf } from "@/components/island/shelf";
import { IslandStatus } from "@/components/island/status";
import { StickerSheet } from "@/components/island/sticker";
import { useGame } from "@/components/island/store";

/**
 * The HUD's one frame for its three layouts (ADR 0050, W7): a column of rows
 * inside the screen's safe areas, the top row first and the bar of a picked
 * thing, the shelf and the dock stacked at the bottom, with the world
 * showing through the row between, at whose foot the game's lines come and
 * go without moving a tool. A phone held sideways gains a column at the
 * left, where the shelf stands for the screen's whole height.
 */
const hudVariants = cva(
  "sideways:grid-cols-[auto_minmax(0,1fr)] pointer-events-none absolute inset-0 grid grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto_auto_auto] justify-items-center p-[max(0.5rem,env(safe-area-inset-top))_max(0.5rem,env(safe-area-inset-right))_max(0.5rem,env(safe-area-inset-bottom))_max(0.5rem,env(safe-area-inset-left))] sm:p-[max(0.75rem,env(safe-area-inset-top))_max(0.75rem,env(safe-area-inset-right))_max(0.75rem,env(safe-area-inset-bottom))_max(0.75rem,env(safe-area-inset-left))]"
);

/** The shelf, which only the learner's own world shows, and only while they build or shape the land. */
function Shelf() {
  const editing = useGame(
    (state) => state.host === null && state.mode !== "explore"
  );
  return editing ? <IslandShelf /> : null;
}

/** The sheets over the world: the share sheet in the learner's own world, the sticker sheet in someone else's. */
function Sheets() {
  const visiting = useGame((state) => state.host !== null);
  return (
    <>
      <GuideSheet />
      <BoardSheet />
      <MapSheet />
      {visiting ? <StickerSheet /> : <ShareSheet />}
    </>
  );
}

/**
 * The HUD over the world (ADR 0050, W7): identity and Stars at the top left;
 * the map, the clock and the weather at the top right; the tools at the
 * bottom centre with the shelf over them; the game's lines, the sheets, and
 * the cover that waits for the first frame. It lets every press it does not
 * take fall through to the world.
 */
export function IslandHud() {
  return (
    <div className={hudVariants()}>
      <IslandStatus />
      <IslandNotices />
      <IslandPick />
      <Shelf />
      <IslandDock />
      <Sheets />
      <IslandCover />
    </div>
  );
}
