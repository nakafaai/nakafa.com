import { Schema } from "effect";

/** Fields consumed from OpenWeather's current-weather response. */
export const OpenWeatherCurrentResponseSchema = Schema.Struct({
  main: Schema.Struct({
    temp: Schema.Finite,
  }),
  name: Schema.String,
  sys: Schema.Struct({
    country: Schema.String,
  }),
  weather: Schema.Array(
    Schema.Struct({
      description: Schema.String,
      icon: Schema.String,
    })
  ),
});

/** Narrow current-weather summary returned by the Nakafa weather route. */
export const CurrentWeatherSummarySchema = Schema.Struct({
  city: Schema.String,
  condition: Schema.String,
  country: Schema.String,
  icon: Schema.String,
  temperatureKelvin: Schema.Finite,
});

export type CurrentWeatherSummary = Schema.Schema.Type<
  typeof CurrentWeatherSummarySchema
>;
