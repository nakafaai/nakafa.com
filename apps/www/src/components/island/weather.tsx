"use client";

import { Effect, Fiber, Option } from "effect";
import { use } from "react";
import { type GameStoreApi, GameStoreContext } from "@/components/island/store";
import { weatherOf } from "@/lib/island/sky";

/**
 * Reads the learner's own weather from the route the app's weather card reads,
 * loading its request code only now, and sets it on the game. When the weather
 * cannot be read, the sky stays clear.
 */
function readWeather(store: GameStoreApi) {
  return Effect.runFork(
    Effect.tryPromise(() => import("@/lib/weather/request")).pipe(
      Effect.flatMap(({ readWeatherSummary }) =>
        Effect.tryPromise(() => readWeatherSummary())
      ),
      Effect.map((read) =>
        Option.map(read, (summary) =>
          store.getState().setWeather(weatherOf(summary.icon))
        )
      ),
      Effect.ignore
    )
  );
}

/**
 * Lets it rain or snow over the island when it does where the learner is
 * (ADR 0047, D8), read once as they enter.
 */
export function IslandWeather() {
  const store = use(GameStoreContext);
  if (store === null) {
    throw new Error("IslandWeather must be used within the island game");
  }
  return (
    <span
      hidden
      ref={(node) => {
        if (node === null) {
          return;
        }
        const reading = readWeather(store);
        return () => {
          Effect.runFork(Fiber.interrupt(reading));
        };
      }}
    />
  );
}
