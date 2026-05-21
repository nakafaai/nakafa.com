import { Schema } from "effect";

/** Reverse geocoding response from OpenWeather. */
export const ReverseGeocodeSchema = Schema.Array(
  Schema.Struct({
    country: Schema.String,
    lat: Schema.Number,
    local_names: Schema.optional(
      Schema.Record({ key: Schema.String, value: Schema.String })
    ),
    lon: Schema.Number,
    name: Schema.String,
    state: Schema.optional(Schema.String),
  }).pipe(Schema.mutable)
).pipe(Schema.mutable);

/** Weather condition entry from OpenWeather forecast responses. */
export const WeatherConditionSchema = Schema.Struct({
  description: Schema.String,
  icon: Schema.String,
  id: Schema.Number,
  main: Schema.String,
}).pipe(Schema.mutable);

/** Main temperature, pressure, and humidity payload. */
export const MainWeatherSchema = Schema.Struct({
  feels_like: Schema.Number,
  grnd_level: Schema.optional(Schema.Number),
  humidity: Schema.Number,
  pressure: Schema.Number,
  sea_level: Schema.optional(Schema.Number),
  temp: Schema.Number,
  temp_kf: Schema.optional(Schema.Number),
  temp_max: Schema.Number,
  temp_min: Schema.Number,
}).pipe(Schema.mutable);

/** Cloudiness payload. */
export const CloudsSchema = Schema.Struct({
  all: Schema.Number,
}).pipe(Schema.mutable);

/** Wind speed and direction payload. */
export const WindSchema = Schema.Struct({
  deg: Schema.Number,
  gust: Schema.optional(Schema.Number),
  speed: Schema.Number,
}).pipe(Schema.mutable);

/** Rain volume payload. */
export const RainSchema = Schema.Struct({
  "1h": Schema.optional(Schema.Number),
  "3h": Schema.optional(Schema.Number),
}).pipe(Schema.mutable);

/** Snow volume payload. */
export const SnowSchema = Schema.Struct({
  "1h": Schema.optional(Schema.Number),
  "3h": Schema.optional(Schema.Number),
}).pipe(Schema.mutable);

/** One 5-day forecast item from OpenWeather. */
export const WeatherListItemSchema = Schema.Struct({
  clouds: CloudsSchema,
  dt: Schema.Number,
  dt_txt: Schema.String,
  main: MainWeatherSchema,
  pop: Schema.Number,
  rain: Schema.optional(RainSchema),
  snow: Schema.optional(SnowSchema),
  sys: Schema.Struct({
    pod: Schema.String,
  }).pipe(Schema.mutable),
  visibility: Schema.optional(Schema.Number),
  weather: Schema.Array(WeatherConditionSchema).pipe(Schema.mutable),
  wind: WindSchema,
}).pipe(Schema.mutable);

/** City metadata from OpenWeather forecast responses. */
export const CitySchema = Schema.Struct({
  coord: Schema.Struct({
    lat: Schema.Number,
    lon: Schema.Number,
  }).pipe(Schema.mutable),
  country: Schema.String,
  id: Schema.Number,
  name: Schema.String,
  population: Schema.optional(Schema.Number),
  sunrise: Schema.Number,
  sunset: Schema.Number,
  timezone: Schema.Number,
}).pipe(Schema.mutable);

/** 5-day forecast response from OpenWeather. */
export const WeatherResponseSchema = Schema.Struct({
  city: CitySchema,
  cnt: Schema.Number,
  cod: Schema.String,
  list: Schema.Array(WeatherListItemSchema).pipe(Schema.mutable),
  message: Schema.Number,
}).pipe(Schema.mutable);

/** Air-pollution pollutant concentration payload. */
export const AirPollutionComponentsSchema = Schema.Struct({
  co: Schema.Number,
  nh3: Schema.Number,
  no: Schema.Number,
  no2: Schema.Number,
  o3: Schema.Number,
  pm10: Schema.Number,
  pm2_5: Schema.Number,
  so2: Schema.Number,
}).pipe(Schema.mutable);

/** One air-pollution reading from OpenWeather. */
export const AirPollutionListItemSchema = Schema.Struct({
  components: AirPollutionComponentsSchema,
  dt: Schema.Number,
  main: Schema.Struct({
    aqi: Schema.Number,
  }).pipe(Schema.mutable),
}).pipe(Schema.mutable);

/** Air-pollution response from OpenWeather. */
export const AirPollutionResponseSchema = Schema.Struct({
  coord: Schema.Struct({
    lat: Schema.Number,
    lon: Schema.Number,
  }).pipe(Schema.mutable),
  list: Schema.Array(AirPollutionListItemSchema).pipe(Schema.mutable),
}).pipe(Schema.mutable);

/** Geographic data used by Nina weather context. */
export const GeoDataSchema = Schema.Struct({
  city: Schema.String,
  country: Schema.String,
  latitude: Schema.String,
  longitude: Schema.String,
});

/** Geographic data used by Nina weather context. */
export type GeoData = Schema.Schema.Type<typeof GeoDataSchema>;
