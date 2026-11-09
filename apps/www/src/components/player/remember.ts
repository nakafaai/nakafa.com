import { Effect, Option } from "effect";
import {
  type AddressRouter,
  replaceSearchParam,
} from "@/components/player/address";
import { PLAYER_MODE_PARAM, type PlayerMode } from "@/components/player/mode";
import { savePlayerMode } from "@/components/player/preference";
import { reportClientException } from "@/lib/analytics/client";

/**
 * Keeps the `view` parameter in step with the saved view when the address
 * carries one, so a reload cannot undo the choice. An address without the
 * parameter stays as it is. An address that cannot be written is reported, and
 * the view stays saved.
 */
const syncModeParam = (router: AddressRouter, mode: PlayerMode) =>
  new URLSearchParams(window.location.search).has(PLAYER_MODE_PARAM)
    ? replaceSearchParam(router, PLAYER_MODE_PARAM, Option.some(mode)).pipe(
        Effect.catch((error) =>
          reportClientException(error, { source: "player-address" })
        )
      )
    : Effect.void;

/** Saves the chosen view for the next page; true when it was saved, false when it was not. */
export const rememberPlayerMode = Effect.fn("player.mode.rememberInBrowser")(
  (router: AddressRouter, mode: PlayerMode) =>
    Effect.tryPromise(() => savePlayerMode({ data: mode })).pipe(
      Effect.tap(() => syncModeParam(router, mode)),
      Effect.as(true),
      Effect.catch((error) =>
        reportClientException(error, { source: "player-view" }).pipe(
          Effect.as(false)
        )
      )
    )
);
