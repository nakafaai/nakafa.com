import { readEnvironment } from "@repo/utilities/env";
import { Schema } from "effect";

/**
 * Reads the OpenWeather key that the current-weather request sends. A missing or
 * blank key leaves weather unconfigured, which the client reports as its own
 * error. The Worker binds the key with the other server values.
 */
export const weatherKeys = () =>
  readEnvironment(
    { OPENWEATHER_API_KEY: Schema.UndefinedOr(Schema.String) },
    { OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY }
  );
