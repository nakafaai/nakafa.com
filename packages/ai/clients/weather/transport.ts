import {
  HttpClient,
  HttpClientResponse,
  type UrlParams,
} from "@effect/platform";
import { Effect, Schedule, Schema } from "effect";

const WEATHER_REQUEST_TIMEOUT = "10 seconds";

class WeatherClientRequestError extends Schema.TaggedError<WeatherClientRequestError>()(
  "WeatherClientRequestError",
  {
    endpoint: Schema.String,
    message: Schema.String,
  }
) {}

interface WeatherRequestInput {
  endpoint: string;
  searchParams: UrlParams.Input;
  url: string;
}

/** Requests OpenWeather JSON through the injected Effect HTTP client. */
export const requestWeatherJson = Effect.fn("weather.requestJson")(function* ({
  endpoint,
  searchParams,
  url,
}: WeatherRequestInput) {
  const client = (yield* HttpClient.HttpClient).pipe(
    // OpenWeather requires `appid` in the query, so its URL must not enter telemetry.
    HttpClient.withTracerDisabledWhen(() => true),
    HttpClient.retryTransient({
      schedule: Schedule.exponential("300 millis"),
      times: 2,
    })
  );

  return yield* client.get(url, { urlParams: searchParams }).pipe(
    Effect.flatMap(HttpClientResponse.filterStatusOk),
    Effect.flatMap((response) => response.json),
    Effect.timeout(WEATHER_REQUEST_TIMEOUT),
    Effect.mapError(
      () =>
        new WeatherClientRequestError({
          endpoint,
          message: `OpenWeather request failed for ${endpoint}.`,
        })
    )
  );
});
