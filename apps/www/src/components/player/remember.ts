import { Effect, Option } from "effect";
import { replaceSearchParam } from "@/components/player/address";
import { PLAYER_MODE_PARAM, type PlayerMode } from "@/components/player/mode";
import { savePlayerMode } from "@/components/player/preference";
import { reportClientException } from "@/lib/analytics/client";

/**
 * Keeps the `view` parameter in step with the saved view when the address
 * carries one, so a reload cannot undo the choice. An address without the
 * parameter stays as it is.
 */
function syncModeParam(mode: PlayerMode) {
  if (new URLSearchParams(window.location.search).has(PLAYER_MODE_PARAM)) {
    replaceSearchParam(PLAYER_MODE_PARAM, Option.some(mode));
  }
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
