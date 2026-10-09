import { FetchClient } from "@repo/utilities/http/client";
import { DateTime, Effect, Option, Schedule } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import {
  type CurrentWeatherSummary,
  CurrentWeatherSummarySchema,
} from "@/lib/weather/schema";

/** The longest the browser waits for one attempt at the app's weather route. */
const WEATHER_ROUTE_TIMEOUT = "10 seconds";
/** Three retries, after one, two and four seconds, as the query client made by default. */
const WEATHER_RETRY_TIMES = 3;
const WEATHER_RETRY_DELAY = "1 second";
/** A summary is shared for a minute, the stale time the query client used. */
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
 * apart. A request that failed is not shared, so the next read asks again, as
 * an errored query did when it mounted.
 */
export function createWeatherReader({
  load,
  now,
}: {
  readonly load: () => Promise<WeatherRead>;
  readonly now: () => number;
}): () => Promise<WeatherRead> {
  let sharedPromise: Promise<WeatherRead> | undefined;
  let sharedStartedAt = 0;

  return () => {
    const at = now();
    if (sharedPromise && at - sharedStartedAt < WEATHER_REUSE_MS) {
      return sharedPromise;
    }

    const promise = load().then((read) => {
      if (Option.isNone(read) && sharedPromise === promise) {
        sharedPromise = undefined;
      }
      return read;
    });
    sharedPromise = promise;
    sharedStartedAt = at;
    return promise;
  };
}

/** The weather read for this browser: one request, shared for a minute. */
export const readWeatherSummary = createWeatherReader({
  load: loadWeatherSummary,
  now: () => DateTime.toEpochMillis(DateTime.nowUnsafe()),
});
