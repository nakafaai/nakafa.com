import {
  AirPollutionResponseSchema,
  type GeoData,
  ReverseGeocodeSchema,
  WeatherResponseSchema,
} from "@repo/ai/clients/weather/schema";
import { requestWeatherJson } from "@repo/ai/clients/weather/transport";
import { weatherKeys } from "@repo/ai/keys";
import { logError, timeOperation } from "@repo/utilities/logging/effect";
import { Effect, Schema } from "effect";

const GEO_BASE_URL = "https://api.openweathermap.org/geo/1.0";
const WEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5";
export const DEFAULT_LATITUDE = "-6.2088";
export const DEFAULT_LONGITUDE = "106.8456";

type AirPollutionResponse = Schema.Schema.Type<
  typeof AirPollutionResponseSchema
>;

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
      const apiKey = weatherKeys().OPENWEATHER_API_KEY;

      yield* Effect.logInfo("Fetching weather data").pipe(
        Effect.annotateLogs(context)
      );

      const geoData = yield* fetchGeoData(apiKey, latitude, longitude);

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
            fetchWeatherForecast(apiKey, geoData.latitude, geoData.longitude),
            fetchAirPollution(apiKey, geoData.latitude, geoData.longitude),
            fetchAirPollutionForecast(
              apiKey,
              geoData.latitude,
              geoData.longitude
            ),
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
  apiKey: string,
  latitude: string,
  longitude: string
) {
  const context = { service: "weather", latitude, longitude };

  yield* Effect.logDebug("Fetching geocoding data").pipe(
    Effect.annotateLogs(context)
  );

  const locations = yield* requestWeatherJson({
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
    Effect.catchTags({
      WeatherClientRequestError: (error) =>
        logError(error, {
          ...context,
          operation: "fetchGeoData",
        }).pipe(Effect.as([])),
      ParseError: (error) =>
        Effect.logWarning("Geocoding validation failed").pipe(
          Effect.annotateLogs({ ...context, cause: error.message }),
          Effect.as([])
        ),
    })
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
  function* (apiKey: string, latitude: string, longitude: string) {
    const context = { service: "weather", latitude, longitude };

    yield* Effect.logDebug("Fetching weather forecast").pipe(
      Effect.annotateLogs(context)
    );

    return yield* requestWeatherJson({
      endpoint: "weather-forecast",
      searchParams: {
        appid: apiKey,
        lat: latitude,
        lon: longitude,
      },
      url: `${WEATHER_BASE_URL}/forecast`,
    }).pipe(Effect.flatMap(Schema.decodeUnknown(WeatherResponseSchema)));
  }
);

/** Fetches current air pollution data. */
const fetchAirPollution = Effect.fn("weather.fetchAirPollution")(function* (
  apiKey: string,
  latitude: string,
  longitude: string
) {
  const context = { service: "weather", latitude, longitude };

  yield* Effect.logDebug("Fetching air pollution data").pipe(
    Effect.annotateLogs(context)
  );

  return yield* requestWeatherJson({
    endpoint: "air-pollution",
    searchParams: {
      appid: apiKey,
      lat: latitude,
      lon: longitude,
    },
    url: `${WEATHER_BASE_URL}/air_pollution`,
  }).pipe(
    Effect.flatMap(Schema.decodeUnknown(AirPollutionResponseSchema)),
    Effect.catchTags({
      WeatherClientRequestError: (error) =>
        logError(error, {
          ...context,
          operation: "fetchAirPollution",
        }).pipe(Effect.as(emptyAirPollution(latitude, longitude))),
      ParseError: (error) =>
        Effect.logWarning("Air pollution validation failed").pipe(
          Effect.annotateLogs({ ...context, cause: error.message }),
          Effect.as(emptyAirPollution(latitude, longitude))
        ),
    })
  );
});

/** Fetches air pollution forecast data. */
const fetchAirPollutionForecast = Effect.fn(
  "weather.fetchAirPollutionForecast"
)(function* (apiKey: string, latitude: string, longitude: string) {
  const context = { service: "weather", latitude, longitude };

  yield* Effect.logDebug("Fetching air pollution forecast").pipe(
    Effect.annotateLogs(context)
  );

  return yield* requestWeatherJson({
    endpoint: "air-pollution-forecast",
    searchParams: {
      appid: apiKey,
      lat: latitude,
      lon: longitude,
    },
    url: `${WEATHER_BASE_URL}/air_pollution/forecast`,
  }).pipe(
    Effect.flatMap(Schema.decodeUnknown(AirPollutionResponseSchema)),
    Effect.catchTags({
      WeatherClientRequestError: (error) =>
        logError(error, {
          ...context,
          operation: "fetchAirPollutionForecast",
        }).pipe(Effect.as(emptyAirPollution(latitude, longitude))),
      ParseError: (error) =>
        Effect.logWarning("Air pollution forecast validation failed").pipe(
          Effect.annotateLogs({ ...context, cause: error.message }),
          Effect.as(emptyAirPollution(latitude, longitude))
        ),
    })
  );
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
