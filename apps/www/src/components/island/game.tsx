"use client";

import type { BlockKey } from "@repo/backend/confect/island/blocks";
import { useState } from "react";
import { IslandHud } from "@/components/island/hud";
import { IslandStage } from "@/components/island/stage";
import { createGameStore, GameStoreContext } from "@/components/island/store";
import { terrainOf } from "@/lib/island/terrain";

/** The blocks in the hotbar of a new game: the first level's shelf. */
const FIRST_HOTBAR: readonly BlockKey[] = [
  "grass",
  "dirt",
  "sand",
  "log",
  "planks",
  "leaves",
  "flowers",
  "stone",
  "glass",
];

/**
 * The island game on the whole screen (ADR 0047): the world generated from the
 * island's seed and footprint, the stage that draws and plays it, and the HUD
 * over it. Its code loads only when the learner enters.
 */
export default function IslandGame({
  level,
  onLeave,
  seed,
  size,
}: {
  level: number;
  onLeave: () => void;
  seed: number;
  size: number;
}) {
  const [store] = useState(() =>
    createGameStore(terrainOf(seed, size), FIRST_HOTBAR, level)
  );
  return (
    <GameStoreContext value={store}>
      <div className="fixed inset-0 overflow-hidden bg-[#5aa7e6]">
        <IslandStage size={size} />
        <IslandHud onLeave={onLeave} />
      </div>
    </GameStoreContext>
  );
}
