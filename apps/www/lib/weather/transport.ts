import { Effect, Schedule, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";

const WEATHER_REQUEST_TIMEOUT = "10 seconds";

class WeatherClientRequestError extends Schema.TaggedError<WeatherClientRequestError>()(
  "WeatherClientRequestError",
  {
    endpoint: Schema.String,
    message: Schema.String,
  }
) {}

// Flat query values, as UrlParams reads them: a scalar, or an array that
// repeats its key. UrlParams skips undefined values.
const WeatherSearchParamScalarSchema = Schema.Union([
  Schema.String,
  Schema.Finite,
  Schema.BigInt,
  Schema.Boolean,
  Schema.Null,
  Schema.Undefined,
]);
const WeatherRequestInputSchema = Schema.Struct({
  endpoint: Schema.String,
  searchParams: Schema.Record(
    Schema.String,
    Schema.Union([
      WeatherSearchParamScalarSchema,
      Schema.Array(WeatherSearchParamScalarSchema),
    ])
  ),
  url: Schema.String,
});
type WeatherRequestInput = typeof WeatherRequestInputSchema.Type;

/** Requests OpenWeather JSON through the injected Effect HTTP client. */
export const requestWeatherJson = Effect.fn("weather.requestJson")(function* ({
  endpoint,
  searchParams,
  url,
}: WeatherRequestInput) {
  const client = (yield* HttpClient.HttpClient).pipe(
    HttpClient.retryTransient({
      schedule: Schedule.exponential("300 millis"),
      times: 2,
    })
  );

  return yield* client.get(url, { urlParams: searchParams }).pipe(
    Effect.flatMap(HttpClientResponse.filterStatusOk),
    Effect.flatMap((response) => response.json),
    // OpenWeather requires `appid` in the query, so its URL must not enter telemetry.
    Effect.provideService(HttpClient.TracerDisabledWhen, () => true),
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
