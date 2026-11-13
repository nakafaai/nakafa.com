"use client";

import { BLOCK_KEYS, isOpen } from "@repo/backend/confect/island/blocks";
import type { Edit } from "@repo/backend/confect/island/world";
import { Array as Arr } from "effect";
import { useState } from "react";
import { IslandHud } from "@/components/island/hud";
import { IslandStage } from "@/components/island/stage";
import {
  createGameStore,
  GameStoreContext,
  type Progress,
} from "@/components/island/store";
import { IslandSync } from "@/components/island/sync";
import { IslandWeather } from "@/components/island/weather";
import { worldOf } from "@/lib/island/terrain";

/** The hotbar a game opens with: the first nine blocks the island's level opens. */
function firstHotbar(level: number) {
  return Arr.take(
    Arr.filter(BLOCK_KEYS, (block) => isOpen(block, level)),
    9
  );
}

/**
 * The island game on the whole screen (ADR 0047): the learner's world, the
 * stage that draws and plays it, the HUD over it, and the sync that keeps the
 * server's copy in step. Its code loads only when the learner enters.
 */
export default function IslandGame({
  edits,
  level,
  onLeave,
  progress,
  seed,
  size,
  version,
}: {
  edits: readonly Edit[];
  level: number;
  onLeave: () => void;
  progress: Progress;
  seed: number;
  size: number;
  version: number;
}) {
  const [store] = useState(() =>
    createGameStore({
      cells: worldOf(seed, size, edits),
      hotbar: firstHotbar(level),
      leave: onLeave,
      level,
      progress,
      version,
    })
  );
  return (
    <GameStoreContext value={store}>
      <div className="fixed inset-0 overflow-hidden bg-[#5aa7e6]">
        <IslandStage size={size} />
        <IslandHud />
        <IslandSync />
        <IslandWeather />
      </div>
    </GameStoreContext>
  );
}
