import { FetchClient } from "@repo/utilities/http/client";
import { DateTime, Effect, MutableRef, Option, Schedule } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import {
  type CurrentWeatherSummary,
  CurrentWeatherSummarySchema,
} from "@/lib/weather/schema";

/** The longest the browser waits for one attempt at the app's weather route. */
const WEATHER_ROUTE_TIMEOUT = "10 seconds";
/** A failed attempt is tried again three times, after one, two, and four seconds. */
const WEATHER_RETRY_TIMES = 3;
const WEATHER_RETRY_DELAY = "1 second";
/** Reads less than a minute apart share one request. */
const WEATHER_REUSE_MS = 60_000;

/** The widget's read: the summary, or nothing when the request failed. */
export type WeatherRead = Option.Option<CurrentWeatherSummary>;

/** Posts to the app's weather route and decodes the summary, retrying transient failures. */
export const requestWeatherSummary = Effect.fn("www.weather.request")(
  function* () {
    return yield* HttpClient.post("/api/weather").pipe(
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.flatMap(
        HttpClientResponse.schemaBodyJson(CurrentWeatherSummarySchema)
      ),
      Effect.timeout(WEATHER_ROUTE_TIMEOUT),
      Effect.retry({
        schedule: Schedule.exponential(WEATHER_RETRY_DELAY),
        times: WEATHER_RETRY_TIMES,
      }),
      Effect.provide(FetchClient)
    );
  }
);

/** Starts the request as a Promise, the form React's `use` reads; a failure reads as None. */
function loadWeatherSummary(): Promise<WeatherRead> {
  return Effect.runPromise(requestWeatherSummary().pipe(Effect.option));
}

/**
 * Makes a reader that shares one request across reads less than a minute
 * apart, counted from the start of the request. Each of those reads gets the
 * same Promise, so a widget that mounts again does not suspend. A request that
 * failed is not shared: the next read asks again.
 */
export function createWeatherReader({
  load,
  now,
}: {
  readonly load: () => Promise<WeatherRead>;
  readonly now: () => number;
}): () => Promise<WeatherRead> {
  const shared = MutableRef.make(
    Option.none<{
      readonly promise: Promise<WeatherRead>;
      readonly startedAt: number;
    }>()
  );

  return () => {
    const at = now();
    const fresh = Option.filter(
      MutableRef.get(shared),
      ({ startedAt }) => at - startedAt < WEATHER_REUSE_MS
    );
    if (Option.isSome(fresh)) {
      return fresh.value.promise;
    }

    const promise = load().then((read) => {
      const isShared = Option.exists(
        MutableRef.get(shared),
        (entry) => entry.promise === promise
      );
      if (Option.isNone(read) && isShared) {
        MutableRef.set(shared, Option.none());
      }
      return read;
    });
    MutableRef.set(shared, Option.some({ promise, startedAt: at }));
    return promise;
  };
}

/** The weather read for this browser: one request, shared for a minute. */
export const readWeatherSummary = createWeatherReader({
  load: loadWeatherSummary,
  now: () => DateTime.toEpochMillis(DateTime.nowUnsafe()),
});
