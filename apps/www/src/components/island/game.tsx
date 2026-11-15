"use client";

import { BLOCK_KEYS, isOpen } from "@repo/backend/confect/island/blocks";
import { Array as Arr } from "effect";
import { useState } from "react";
import { IslandHud } from "@/components/island/hud";
import { IslandStage } from "@/components/island/stage";
import { createGameStore, GameStoreContext } from "@/components/island/store";
import { terrainOf } from "@/lib/island/terrain";

/** The hotbar a game opens with: the first nine blocks the island's level opens. */
function firstHotbar(level: number) {
  return Arr.take(
    Arr.filter(BLOCK_KEYS, (block) => isOpen(block, level)),
    9
  );
}

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
    createGameStore(terrainOf(seed, size), firstHotbar(level), level, onLeave)
  );
  return (
    <GameStoreContext value={store}>
      <div className="fixed inset-0 overflow-hidden bg-[#5aa7e6]">
        <IslandStage size={size} />
        <IslandHud />
      </div>
    </GameStoreContext>
  );
}
