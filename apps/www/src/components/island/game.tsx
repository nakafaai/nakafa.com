"use client";

import type { Thing } from "@repo/backend/confect/island/things";
import { useState } from "react";
import { IslandHud } from "@/components/island/hud";
import { IslandSound } from "@/components/island/sound";
import { IslandStage } from "@/components/island/stage";
import type { Host, Progress } from "@/components/island/store";
import { createGameStore, GameStoreContext } from "@/components/island/store";
import { IslandSync } from "@/components/island/sync";
import { IslandWeather } from "@/components/island/weather";
import { landOf } from "@/lib/island/land/ground";
import { homeOf } from "@/lib/island/land/home";
import { seedOf } from "@/lib/island/noise";
import { seasonNow } from "@/lib/island/season";
import { readMuted } from "@/lib/island/settings";

/**
 * The world game on the whole screen (ADR 0047; ADR 0050): the land that
 * grows from its owner's seed, the stage that draws and plays it, the HUD
 * over it, and the sync that keeps the server's copy in step. `host` names
 * whose world it is when the learner visits one. Its code loads only when
 * the learner enters.
 */
export default function IslandGame({
  blueprints,
  host,
  level,
  onLeave,
  owner,
  progress,
}: {
  blueprints: readonly Thing[];
  host: Host | null;
  level: number;
  onLeave: () => void;
  /** What the land's seed is made from: its owner's id. */
  owner: string;
  progress: Progress;
}) {
  const [game] = useState(() => {
    const seed = seedOf(owner);
    const home = homeOf(seed);
    return {
      home,
      store: createGameStore({
        blueprints,
        home,
        host,
        land: landOf(seed),
        leave: onLeave,
        level,
        loaded: [],
        muted: readMuted(),
        progress,
        season: seasonNow(),
      }),
    };
  });
  return (
    <GameStoreContext value={game.store}>
      <div className="bg-island-sky fixed inset-0 overflow-hidden">
        <IslandStage home={game.home} />
        <IslandHud />
        <IslandSync />
        <IslandSound />
        <IslandWeather />
      </div>
    </GameStoreContext>
  );
}
