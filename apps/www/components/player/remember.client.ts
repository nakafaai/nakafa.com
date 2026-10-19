"use client";

import { Effect } from "effect";
import { PLAYER_MODE_PARAM, type PlayerMode } from "@/components/player/mode";
import { savePlayerMode } from "@/components/player/preference";
import { reportClientException } from "@/lib/analytics/client";

/**
 * Keeps the `view` parameter in step with the saved view when the address
 * carries one, so a reload cannot undo the choice. An address without the
 * parameter stays as it is.
 */
function syncModeParam(mode: PlayerMode) {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(PLAYER_MODE_PARAM)) {
    return;
  }
  url.searchParams.set(PLAYER_MODE_PARAM, mode);
  window.history.replaceState(null, "", url);
}

/** Saves the chosen view for the next page; true when it was saved, false when it was not. */
export const rememberPlayerMode = Effect.fn("player.mode.rememberInBrowser")(
  (mode: PlayerMode) =>
    Effect.tryPromise(() => savePlayerMode({ data: mode })).pipe(
      Effect.tap(() => Effect.sync(() => syncModeParam(mode))),
      Effect.as(true),
      Effect.catch((error) =>
        reportClientException(error, { source: "player-view" }).pipe(
          Effect.as(false)
        )
      )
    )
);
