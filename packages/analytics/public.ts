import { readEnvironment } from "@repo/utilities/env";
import { Schema } from "effect";

/** A text value that parses as a URL. */
export const urlSchema = Schema.String.pipe(
  Schema.check(Schema.makeFilter((value) => URL.canParse(value)))
);
/**
 * Validates public PostHog values used by browser analytics. This module is
 * browser-safe: it reads no server key.
 */
export const postHogPublicKeys = () =>
  readEnvironment(
    {
      NEXT_PUBLIC_POSTHOG_KEY: Schema.String.check(
        Schema.isStartingWith("phc_")
      ),
      NEXT_PUBLIC_POSTHOG_UI_HOST: urlSchema,
    },
    {
      NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
      NEXT_PUBLIC_POSTHOG_UI_HOST: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST,
    }
  );
