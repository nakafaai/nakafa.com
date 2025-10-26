import { keys } from "@repo/ai/keys";
import {
  createChildLogger,
  createServiceLogger,
  createTimer,
  logError,
} from "@repo/utilities/logging";
import ky from "ky";
import {
  airPollutionResponseSchema,
  type GeoData,
  reverseGeocodeSchema,
  weatherResponseSchema,
} from "./weather-schema";

const apiKey = keys().OPENWEATHER_API_KEY;
const GEO_BASE_URL = "https://api.openweathermap.org/geo/1.0";
const WEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5";

const weatherLogger = createServiceLogger("weather");

/**
 * Fetches comprehensive weather data for given coordinates
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @returns Combined weather data including forecast, air pollution, and location info
 */
export async function getWeather({
  latitude,
  longitude,
}: {
  latitude: string;
  longitude: string;
}) {
  const logger = createChildLogger({ latitude, longitude });
  const endTimer = createTimer(weatherLogger, "fetch_weather_data", {
    latitude,
    longitude,
  });

  try {
    logger.info("Fetching weather data");

    // Step 1: Get geo data
    const geoData = await fetchGeoData(latitude, longitude);
    logger.debug(
      {
        city: geoData.city,
        country: geoData.country,
      },
      "Geocoding completed"
    );

    // Step 2: Fetch all weather data in parallel
    const [weatherResult, airPollutionResult, airPollutionForecastResult] =
      await Promise.all([
        fetchWeatherForecast(geoData.latitude, geoData.longitude),
        fetchAirPollution(geoData.latitude, geoData.longitude),
        fetchAirPollutionForecast(geoData.latitude, geoData.longitude),
      ]);

    logger.info("Weather data fetched successfully");
    endTimer();

    // Return combined data
    return {
      ...weatherResult,
      geocoding: geoData,
      air_pollution: airPollutionResult,
      air_pollution_forecast: airPollutionForecastResult,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logError(logger, err, {
      context: "getWeather",
      latitude,
      longitude,
    });
    throw error;
  }
}

/**
 * Fetches location name from coordinates using reverse geocoding
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @returns Geographic data with city name and country code
 */
async function fetchGeoData(
  latitude: string,
  longitude: string
): Promise<GeoData> {
  try {
    weatherLogger.debug({ latitude, longitude }, "Fetching geocoding data");

    const response = await ky
      .get(`${GEO_BASE_URL}/reverse`, {
        searchParams: {
          lat: latitude,
          lon: longitude,
          limit: "1",
          appid: apiKey,
        },
      })
      .json();

    const result = reverseGeocodeSchema.safeParse(response);

    if (!result.success || result.data.length === 0) {
      weatherLogger.warn(
        {
          latitude,
          longitude,
        },
        "Geocoding returned no results"
      );
      return {
        city: "",
        country: "",
        latitude,
        longitude,
      };
    }

    const location = result.data[0];
    return {
      city: location.name,
      country: location.country,
      latitude,
      longitude,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logError(weatherLogger, err, {
      context: "fetchGeoData",
      latitude,
      longitude,
    });
    return {
      city: "",
      country: "",
      latitude,
      longitude,
    };
  }
}

/**
 * Fetches 5-day/3-hour weather forecast
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @returns Weather forecast data or null on error
 */
async function fetchWeatherForecast(latitude: string, longitude: string) {
  try {
    weatherLogger.debug({ latitude, longitude }, "Fetching weather forecast");

    const response = await ky
      .get(`${WEATHER_BASE_URL}/forecast`, {
        searchParams: {
          lat: latitude,
          lon: longitude,
          appid: apiKey,
        },
      })
      .json();

    const result = weatherResponseSchema.safeParse(response);
    if (!result.success) {
      weatherLogger.warn(
        {
          latitude,
          longitude,
        },
        "Weather forecast validation failed"
      );
    }
    return result.success ? result.data : null;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logError(weatherLogger, err, {
      context: "fetchWeatherForecast",
      latitude,
      longitude,
    });
    return null;
  }
}

/**
 * Fetches current air pollution data
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @returns Air pollution data with AQI and pollutant concentrations
 */
async function fetchAirPollution(latitude: string, longitude: string) {
  try {
    weatherLogger.debug({ latitude, longitude }, "Fetching air pollution data");

    const response = await ky
      .get(`${WEATHER_BASE_URL}/air_pollution`, {
        searchParams: {
          lat: latitude,
          lon: longitude,
          appid: apiKey,
        },
      })
      .json();

    const result = airPollutionResponseSchema.safeParse(response);
    if (!result.success) {
      weatherLogger.warn(
        {
          latitude,
          longitude,
        },
        "Air pollution validation failed"
      );
    }
    return result.success
      ? result.data
      : { coord: { lon: longitude, lat: latitude }, list: [] };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logError(weatherLogger, err, {
      context: "fetchAirPollution",
      latitude,
      longitude,
    });
    return { coord: { lon: longitude, lat: latitude }, list: [] };
  }
}

/**
 * Fetches air pollution forecast
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @returns Air pollution forecast data with predicted AQI values
 */
async function fetchAirPollutionForecast(latitude: string, longitude: string) {
  try {
    weatherLogger.debug(
      {
        latitude,
        longitude,
      },
      "Fetching air pollution forecast"
    );

    const response = await ky
      .get(`${WEATHER_BASE_URL}/air_pollution/forecast`, {
        searchParams: {
          lat: latitude,
          lon: longitude,
          appid: apiKey,
        },
      })
      .json();

    const result = airPollutionResponseSchema.safeParse(response);
    if (!result.success) {
      weatherLogger.warn(
        {
          latitude,
          longitude,
        },
        "Air pollution forecast validation failed"
      );
    }
    return result.success
      ? result.data
      : { coord: { lon: longitude, lat: latitude }, list: [] };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logError(weatherLogger, err, {
      context: "fetchAirPollutionForecast",
      latitude,
      longitude,
    });
    return { coord: { lon: longitude, lat: latitude }, list: [] };
  }
}
