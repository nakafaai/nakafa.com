import { readEnvironment } from "@repo/utilities/env";
import { Schema } from "effect";

/**
 * Defines the public app origin that client and server absolute URL builders
 * share. This module is browser-safe: it reads no server key.
 */
export const appUrlKeys = () =>
  readEnvironment(
    { NEXT_PUBLIC_APP_URL: Schema.NonEmptyString },
    { NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL }
  );
