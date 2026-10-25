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
      VITE_POSTHOG_PROJECT_TOKEN: Schema.String.check(
        Schema.isStartingWith("phc_")
      ),
      VITE_POSTHOG_PROXY_HOST: urlSchema,
      VITE_POSTHOG_UI_HOST: urlSchema,
    },
    {
      VITE_POSTHOG_PROJECT_TOKEN: import.meta.env.VITE_POSTHOG_PROJECT_TOKEN,
      VITE_POSTHOG_PROXY_HOST: import.meta.env.VITE_POSTHOG_PROXY_HOST,
      VITE_POSTHOG_UI_HOST: import.meta.env.VITE_POSTHOG_UI_HOST,
    }
  );
