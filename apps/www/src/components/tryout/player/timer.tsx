import { useNow } from "@/components/player/now";
import { PlayerTimer, PlayerTimerCard } from "@/components/player/timer";

/**
 * Feeds the shared one-second try-out clock into the player's header timer, which steps aside from the large
 * breakpoint where the pane shows the time (`TryoutPlayerTimerCard`).
 */
export function TryoutPlayerTimer({ expiresAt }: { expiresAt: number }) {
  const now = useNow(true);

  return <PlayerTimer seconds={secondsUntil(expiresAt, now)} />;
}

/** Feeds the shared one-second try-out clock into the pane's card of the time left. */
export function TryoutPlayerTimerCard({ expiresAt }: { expiresAt: number }) {
  const now = useNow(true);

  return <PlayerTimerCard seconds={secondsUntil(expiresAt, now)} />;
}

/** Whole seconds from now until the deadline, never below zero. */
function secondsUntil(expiresAt: number, now: number) {
  return Math.max(0, Math.ceil((expiresAt - now) / 1000));
}
