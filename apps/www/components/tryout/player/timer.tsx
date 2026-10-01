"use client";

import { PlayerTimer } from "@/components/player/timer";
import { useTryoutClock } from "@/components/tryout/runtime/clock";

/** Feeds the shared one-second try-out clock into the player timer. */
export function TryoutPlayerTimer({
  expiresAt,
}: {
  readonly expiresAt: number;
}) {
  const now = useTryoutClock(true);
  return (
    <PlayerTimer seconds={Math.max(0, Math.ceil((expiresAt - now) / 1000))} />
  );
}
