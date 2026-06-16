import {
  AirPollutionResponseSchema,
  type GeoData,
  ReverseGeocodeSchema,
  WeatherResponseSchema,
} from "@repo/ai/clients/weather/schema";
import { keys } from "@repo/ai/keys";
import { logError, timeOperation } from "@repo/utilities/logging/effect";
import { Effect, Schema } from "effect";
import ky from "ky";

const apiKey = keys().OPENWEATHER_API_KEY;
const GEO_BASE_URL = "https://api.openweathermap.org/geo/1.0";
const WEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5";
export const DEFAULT_LATITUDE = "-6.2088";
export const DEFAULT_LONGITUDE = "106.8456";

type AirPollutionResponse = Schema.Schema.Type<
  typeof AirPollutionResponseSchema
>;

/** OpenWeather failed before returning usable JSON. */
export class WeatherClientRequestError extends Schema.TaggedError<WeatherClientRequestError>()(
  "WeatherClientRequestError",
  {
    cause: Schema.optional(Schema.String),
    endpoint: Schema.String,
    message: Schema.String,
  }
) {}

/** Fetches comprehensive weather data for given coordinates. */
export const getWeather = Effect.fn("weather.getWeather")(function* ({
  latitude,
  longitude,
}: {
  latitude: string;
  longitude: string;
}) {
  const context = {
    service: "weather",
    latitude,
    longitude,
  };

  return yield* timeOperation(
    "fetch_weather",
    Effect.gen(function* () {
      yield* Effect.logInfo("Fetching weather data").pipe(
        Effect.annotateLogs(context)
      );

      const geoData = yield* fetchGeoData(latitude, longitude);

      yield* Effect.logDebug("Geocoding completed").pipe(
        Effect.annotateLogs({
          ...context,
          city: geoData.city,
          country: geoData.country,
        })
      );

      const [weatherResult, airPollutionResult, airPollutionForecastResult] =
        yield* Effect.all(
          [
            fetchWeatherForecast(geoData.latitude, geoData.longitude),
            fetchAirPollution(geoData.latitude, geoData.longitude),
            fetchAirPollutionForecast(geoData.latitude, geoData.longitude),
          ],
          { concurrency: "unbounded" }
        );

      yield* Effect.logInfo("Weather data fetched successfully").pipe(
        Effect.annotateLogs(context)
      );

      return {
        ...weatherResult,
        air_pollution: airPollutionResult,
        air_pollution_forecast: airPollutionForecastResult,
        geocoding: geoData,
      };
    }),
    context
  );
});

/** Fetches location name from coordinates using reverse geocoding. */
const fetchGeoData = Effect.fn("weather.fetchGeoData")(function* (
  latitude: string,
  longitude: string
) {
  const context = { service: "weather", latitude, longitude };

  yield* Effect.logDebug("Fetching geocoding data").pipe(
    Effect.annotateLogs(context)
  );

  const locations = yield* requestJson({
    endpoint: "reverse-geocode",
    searchParams: {
      appid: apiKey,
      lat: latitude,
      limit: "1",
      lon: longitude,
    },
    url: `${GEO_BASE_URL}/reverse`,
  }).pipe(
    Effect.flatMap(Schema.decodeUnknown(ReverseGeocodeSchema)),
    Effect.catchTag("WeatherClientRequestError", (error) =>
      logError(new Error(error.message), {
        ...context,
        operation: "fetchGeoData",
      }).pipe(Effect.as([]))
    ),
    Effect.catchTag("ParseError", (error) =>
      Effect.logWarning("Geocoding validation failed").pipe(
        Effect.annotateLogs({ ...context, cause: error.message }),
        Effect.as([])
      )
    )
  );

  const location = locations.at(0);

  if (!location) {
    yield* Effect.logWarning("Geocoding returned no results").pipe(
      Effect.annotateLogs(context)
    );

    return emptyGeoData(latitude, longitude);
  }

  return {
    city: location.name,
    country: location.country,
    latitude,
    longitude,
  };
});

/** Fetches 5-day/3-hour weather forecast. */
const fetchWeatherForecast = Effect.fn("weather.fetchWeatherForecast")(
  function* (latitude: string, longitude: string) {
    const context = { service: "weather", latitude, longitude };

    yield* Effect.logDebug("Fetching weather forecast").pipe(
      Effect.annotateLogs(context)
    );

    return yield* requestJson({
      endpoint: "weather-forecast",
      searchParams: {
        appid: apiKey,
        lat: latitude,
        lon: longitude,
      },
      url: `${WEATHER_BASE_URL}/forecast`,
    }).pipe(
      Effect.flatMap(Schema.decodeUnknown(WeatherResponseSchema)),
      Effect.catchTag("WeatherClientRequestError", (error) =>
        logError(new Error(error.message), {
          ...context,
          operation: "fetchWeatherForecast",
        }).pipe(Effect.as(null))
      ),
      Effect.catchTag("ParseError", (error) =>
        Effect.logWarning("Weather forecast validation failed").pipe(
          Effect.annotateLogs({ ...context, cause: error.message }),
          Effect.as(null)
        )
      )
    );
  }
);

/** Fetches current air pollution data. */
const fetchAirPollution = Effect.fn("weather.fetchAirPollution")(function* (
  latitude: string,
  longitude: string
) {
  const context = { service: "weather", latitude, longitude };

  yield* Effect.logDebug("Fetching air pollution data").pipe(
    Effect.annotateLogs(context)
  );

  return yield* requestJson({
    endpoint: "air-pollution",
    searchParams: {
      appid: apiKey,
      lat: latitude,
      lon: longitude,
    },
    url: `${WEATHER_BASE_URL}/air_pollution`,
  }).pipe(
    Effect.flatMap(Schema.decodeUnknown(AirPollutionResponseSchema)),
    Effect.catchTag("WeatherClientRequestError", (error) =>
      logError(new Error(error.message), {
        ...context,
        operation: "fetchAirPollution",
      }).pipe(Effect.as(emptyAirPollution(latitude, longitude)))
    ),
    Effect.catchTag("ParseError", (error) =>
      Effect.logWarning("Air pollution validation failed").pipe(
        Effect.annotateLogs({ ...context, cause: error.message }),
        Effect.as(emptyAirPollution(latitude, longitude))
      )
    )
  );
});

/** Fetches air pollution forecast data. */
const fetchAirPollutionForecast = Effect.fn(
  "weather.fetchAirPollutionForecast"
)(function* (latitude: string, longitude: string) {
  const context = { service: "weather", latitude, longitude };

  yield* Effect.logDebug("Fetching air pollution forecast").pipe(
    Effect.annotateLogs(context)
  );

  return yield* requestJson({
    endpoint: "air-pollution-forecast",
    searchParams: {
      appid: apiKey,
      lat: latitude,
      lon: longitude,
    },
    url: `${WEATHER_BASE_URL}/air_pollution/forecast`,
  }).pipe(
    Effect.flatMap(Schema.decodeUnknown(AirPollutionResponseSchema)),
    Effect.catchTag("WeatherClientRequestError", (error) =>
      logError(new Error(error.message), {
        ...context,
        operation: "fetchAirPollutionForecast",
      }).pipe(Effect.as(emptyAirPollution(latitude, longitude)))
    ),
    Effect.catchTag("ParseError", (error) =>
      Effect.logWarning("Air pollution forecast validation failed").pipe(
        Effect.annotateLogs({ ...context, cause: error.message }),
        Effect.as(emptyAirPollution(latitude, longitude))
      )
    )
  );
});

/** Requests JSON from OpenWeather through an Effect boundary. */
const requestJson = Effect.fn("weather.requestJson")(function* ({
  endpoint,
  searchParams,
  url,
}: {
  endpoint: string;
  searchParams: Record<string, string>;
  url: string;
}) {
  return yield* Effect.tryPromise({
    try: () => ky.get(url, { searchParams }).json(),
    catch: (error) =>
      new WeatherClientRequestError({
        cause: String(error),
        endpoint,
        message: `OpenWeather request failed for ${endpoint}.`,
      }),
  });
});

/** Builds an empty location when reverse geocoding is unavailable. */
function emptyGeoData(latitude: string, longitude: string) {
  return {
    city: "",
    country: "",
    latitude,
    longitude,
  } satisfies GeoData;
}

/** Builds an empty air-pollution payload when OpenWeather cannot provide one. */
function emptyAirPollution(latitude: string, longitude: string) {
  return {
    coord: {
      lat: Number.parseFloat(latitude),
      lon: Number.parseFloat(longitude),
    },
    list: [],
  } satisfies AirPollutionResponse;
}
