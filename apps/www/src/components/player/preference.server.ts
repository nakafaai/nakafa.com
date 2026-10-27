import { setCookie } from "@tanstack/react-start/server";
import { Effect } from "effect";
import {
  PLAYER_MODE_COOKIE,
  PLAYER_MODE_MAX_AGE,
  type PlayerMode,
} from "@/components/player/mode";
import { serverHandler } from "@/lib/server/fn";

/**
 * Writes the view the learner chose. The cookie holds a layout preference and no
 * credential, so the browser may read it: a school sitting, which renders only in
 * the browser, reads the same saved view as a page the server renders.
 */
const rememberPlayerMode = Effect.fn("player.mode.remember")(function* (
  mode: PlayerMode
) {
  yield* Effect.sync(() => {
    setCookie(PLAYER_MODE_COOKIE, mode, {
      maxAge: PLAYER_MODE_MAX_AGE,
      path: "/",
      sameSite: "lax",
    });
  });
});

/** The handler of the view server function, which the tests call directly. */
export const savePlayerModeHandler = serverHandler(rememberPlayerMode);
