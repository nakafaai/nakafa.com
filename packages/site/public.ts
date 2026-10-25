import { readEnvironment } from "@repo/utilities/env";
import { Schema } from "effect";

/**
 * Defines the public app origin that client and server absolute URL builders
 * share. This module is browser-safe: it reads no server key.
 */
export const appUrlKeys = () =>
  readEnvironment(
    { VITE_SITE_URL: Schema.NonEmptyString },
    { VITE_SITE_URL: import.meta.env.VITE_SITE_URL }
  );
