import * as z from "zod";

/**
 * Reverse Geocoding API Schema
 * @see https://openweathermap.org/api/geocoding-api
 * Converts geographic coordinates into location names
 */
export const reverseGeocodeSchema = z.array(
  z.object({
    name: z.string(), // Location name (city/area)
    lat: z.number(), // Latitude
    lon: z.number(), // Longitude
    country: z.string(), // Country code (ISO 3166)
    state: z.string().optional(), // State/region name
    local_names: z.record(z.string(), z.string()).optional(), // Location names in different languages
  })
);

/**
 * Weather Condition Schema
 * Contains weather condition information
 */
export const weatherConditionSchema = z.object({
  id: z.number(), // Weather condition ID
  main: z.string(), // Group of weather parameters (Rain, Snow, Clouds, etc.)
  description: z.string(), // Weather condition description
  icon: z.string(), // Weather icon ID
});

/**
 * Main Weather Parameters Schema
 * Temperature, pressure, and humidity data
 */
export const mainWeatherSchema = z.object({
  temp: z.number(), // Temperature (Kelvin by default, can be changed with units param)
  feels_like: z.number(), // Perceived temperature
  temp_min: z.number(), // Minimum temperature
  temp_max: z.number(), // Maximum temperature
  pressure: z.number(), // Atmospheric pressure (hPa)
  humidity: z.number(), // Humidity percentage
  sea_level: z.number().optional(), // Atmospheric pressure at sea level (hPa)
  grnd_level: z.number().optional(), // Atmospheric pressure at ground level (hPa)
  temp_kf: z.number().optional(), // Internal parameter for temperature difference
});

/**
 * Clouds Schema
 * Cloudiness information
 */
export const cloudsSchema = z.object({
  all: z.number(), // Cloudiness percentage
});

/**
 * Wind Schema
 * Wind speed and direction
 */
export const windSchema = z.object({
  speed: z.number(), // Wind speed (meter/sec by default)
  deg: z.number(), // Wind direction in degrees (meteorological)
  gust: z.number().optional(), // Wind gust speed
});

/**
 * Rain Schema
 * Precipitation volume for rain
 */
export const rainSchema = z.object({
  "1h": z.number().optional(), // Rain volume for last 1 hour (mm)
  "3h": z.number().optional(), // Rain volume for last 3 hours (mm)
});

/**
 * Snow Schema
 * Precipitation volume for snow
 */
export const snowSchema = z.object({
  "1h": z.number().optional(), // Snow volume for last 1 hour (mm)
  "3h": z.number().optional(), // Snow volume for last 3 hours (mm)
});

/**
 * Weather List Item Schema
 * Individual forecast entry in 5-day forecast with 3-hour step
 * @see https://openweathermap.org/forecast5
 */
export const weatherListItemSchema = z.object({
  dt: z.number(), // Time of data forecasted (Unix timestamp, UTC)
  main: mainWeatherSchema, // Main weather parameters
  weather: z.array(weatherConditionSchema), // Weather conditions
  clouds: cloudsSchema, // Cloudiness
  wind: windSchema, // Wind parameters
  visibility: z.number(), // Visibility in meters (max 10km)
  pop: z.number(), // Probability of precipitation (0-1)
  rain: rainSchema.optional(), // Rain volume
  snow: snowSchema.optional(), // Snow volume
  sys: z.object({
    pod: z.string(), // Part of day: "n" = night, "d" = day
  }),
  dt_txt: z.string(), // Time of data forecasted (ISO 8601 format)
});

/**
 * City Schema
 * City information in forecast response
 * @see https://openweathermap.org/forecast5
 */
export const citySchema = z.object({
  id: z.number(), // City ID
  name: z.string(), // City name
  coord: z.object({
    lat: z.number(), // City geo location latitude
    lon: z.number(), // City geo location longitude
  }),
  country: z.string(), // Country code (ISO 3166)
  population: z.number().optional(), // City population
  timezone: z.number(), // Shift in seconds from UTC
  sunrise: z.number(), // Sunrise time (Unix timestamp, UTC)
  sunset: z.number(), // Sunset time (Unix timestamp, UTC)
});

/**
 * 5-Day / 3-Hour Forecast Response Schema
 * @see https://openweathermap.org/forecast5
 */
export const weatherResponseSchema = z.object({
  cod: z.string(), // Internal parameter
  message: z.number(), // Internal parameter
  cnt: z.number(), // Number of forecast entries
  list: z.array(weatherListItemSchema), // List of forecast data
  city: citySchema, // City information
});

/**
 * Air Pollution Components Schema
 * Concentration of pollutants (μg/m³)
 * @see https://openweathermap.org/api/air-pollution
 */
export const airPollutionComponentsSchema = z.object({
  co: z.number(), // Carbon monoxide (μg/m³)
  no: z.number(), // Nitrogen monoxide (μg/m³)
  no2: z.number(), // Nitrogen dioxide (μg/m³)
  o3: z.number(), // Ozone (μg/m³)
  so2: z.number(), // Sulphur dioxide (μg/m³)
  pm2_5: z.number(), // Fine particles matter (μg/m³)
  pm10: z.number(), // Coarse particulate matter (μg/m³)
  nh3: z.number(), // Ammonia (μg/m³)
});

/**
 * Air Pollution List Item Schema
 * Individual air quality entry
 * @see https://openweathermap.org/api/air-pollution
 */
export const airPollutionListItemSchema = z.object({
  dt: z.number(), // Date and time (Unix timestamp, UTC)
  main: z.object({
    aqi: z.number(), // Air Quality Index: 1=Good, 2=Fair, 3=Moderate, 4=Poor, 5=Very Poor
  }),
  components: airPollutionComponentsSchema, // Pollutant concentrations
});

/**
 * Air Pollution API Response Schema
 * @see https://openweathermap.org/api/air-pollution
 */
export const airPollutionResponseSchema = z.object({
  coord: z.object({
    lon: z.number(), // Longitude
    lat: z.number(), // Latitude
  }),
  list: z.array(airPollutionListItemSchema), // Air quality data list
});

/**
 * Type Definitions
 */

/**
 * Geographic Data Type
 * Contains location information from reverse geocoding
 */
export interface GeoData {
  city: string; // City/location name
  country: string; // Country code (ISO 3166)
  latitude: string; // Latitude coordinate
  longitude: string; // Longitude coordinate
}
