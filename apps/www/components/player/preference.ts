import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import { Effect, Schema } from "effect";
import {
  PLAYER_MODE_COOKIE,
  PLAYER_MODE_MAX_AGE,
  type PlayerMode,
  PlayerModeSchema,
} from "@/components/player/mode";
import { serverHandler } from "@/lib/server/fn";

const rememberPlayerMode = Effect.fn("player.mode.remember")(function* (
  mode: PlayerMode
) {
  yield* Effect.sync(() => {
    setCookie(PLAYER_MODE_COOKIE, mode, {
      httpOnly: true,
      maxAge: PLAYER_MODE_MAX_AGE,
      path: "/",
      sameSite: "lax",
    });
  });
});

/** The handler of the view server function, which the tests call directly. */
export const savePlayerModeHandler = serverHandler(rememberPlayerMode);

/**
 * Remembers the view a learner chose, so the server renders it first on their
 * next page. A server function is the framework boundary for writing a cookie:
 * the browser cannot write an `httpOnly` cookie. The argument arrives from the
 * network, so the validator decodes it before the handler stores it.
 */
export const savePlayerMode = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(PlayerModeSchema))
  .handler(savePlayerModeHandler);
