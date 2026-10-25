import { readEnvironment } from "@repo/utilities/env";
import { Schema } from "effect";

/**
 * Defines the public app origin that client and server absolute URL builders
 * share. This module is browser-safe: it reads no server key.
 */
export const appUrlKeys = () =>
  readEnvironment(
    { VITE_APP_URL: Schema.NonEmptyString },
    { VITE_APP_URL: import.meta.env.VITE_APP_URL }
  );
