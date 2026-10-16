"use server";

import { Effect, Schema } from "effect";
import { cookies } from "next/headers";
import {
  PLAYER_MODE_COOKIE,
  PLAYER_MODE_MAX_AGE,
  PlayerModeSchema,
} from "@/components/player/mode";

const remember = Effect.fn("player.mode.remember")(function* (input: unknown) {
  const mode = yield* Schema.decodeUnknownEffect(PlayerModeSchema)(input);
  const store = yield* Effect.tryPromise(() => cookies());
  yield* Effect.sync(() => {
    store.set(PLAYER_MODE_COOKIE, mode, {
      httpOnly: true,
      maxAge: PLAYER_MODE_MAX_AGE,
      path: "/",
      sameSite: "lax",
    });
  });
});

/**
 * Remembers the view a learner chose, so the server renders it first on their
 * next page.
 *
 * A Server Action is the framework boundary for writing a cookie here: the
 * browser would need `document.cookie`, which this codebase does not use. The
 * cookie is read only on the server, so it is `httpOnly`. Next.js renders the
 * current page again in the response of an action that sets a cookie, and the
 * open player ignores that render, because its store already shows the chosen
 * view.
 *
 * The argument arrives from the network, so it is decoded before it is stored.
 */
export async function savePlayerMode(mode: unknown) {
  await Effect.runPromise(remember(mode));
}
