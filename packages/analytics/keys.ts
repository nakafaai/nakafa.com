import { InvalidEnvironmentError } from "@repo/utilities/env";
import { Config, ConfigProvider, Effect, Schema } from "effect";

const postHogKeySchema = Schema.String.check(Schema.isStartingWith("phc_"));
const urlSchema = Schema.String.pipe(
  Schema.check(Schema.makeFilter((value) => URL.canParse(value)))
);
const optionalStringSchema = Schema.UndefinedOr(Schema.String);
/**
 * Validates the PostHog managed reverse proxy host read by Next config. Server
 * code only: the browser never reads this key.
 */
export const postHogProxyKeys = () => {
  const config = {
    POSTHOG_PROXY_HOST: Config.schema(urlSchema, "POSTHOG_PROXY_HOST"),
  };
  const values = {
    POSTHOG_PROXY_HOST: process.env.POSTHOG_PROXY_HOST,
  } satisfies Record<keyof typeof config, string | undefined>;
  return Effect.runSync(
    Config.all(config)
      .parse(ConfigProvider.fromUnknown(values, { preserveEmptyStrings: true }))
      .pipe(
        Effect.mapError(
          (error) => new InvalidEnvironmentError({ details: error.message })
        )
      )
  );
};
/** Validates public PostHog values used by browser analytics. */
export const postHogPublicKeys = () => {
  const config = {
    NEXT_PUBLIC_POSTHOG_KEY: Config.schema(
      postHogKeySchema,
      "NEXT_PUBLIC_POSTHOG_KEY"
    ),
    NEXT_PUBLIC_POSTHOG_UI_HOST: Config.schema(
      urlSchema,
      "NEXT_PUBLIC_POSTHOG_UI_HOST"
    ),
  };
  const values = {
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_UI_HOST: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST,
  } satisfies Record<keyof typeof config, string | undefined>;
  return Effect.runSync(
    Config.all(config)
      .parse(ConfigProvider.fromUnknown(values, { preserveEmptyStrings: true }))
      .pipe(
        Effect.mapError(
          (error) => new InvalidEnvironmentError({ details: error.message })
        )
      )
  );
};
/**
 * Validate the shared PostHog environment contract used by server analytics.
 * The browser reads `postHogPublicKeys` instead, so it never reads a server key.
 *
 * References:
 * https://posthog.com/docs/libraries/next-js
 * https://posthog.com/docs/libraries/node
 * https://posthog.com/docs/advanced/proxy/managed-reverse-proxy
 */
export const keys = () => ({
  ...postHogProxyKeys(),
  ...postHogPublicKeys(),
});
/**
 * Reads the deployment fields that decide whether server reporting runs. Both
 * accept any text, and this owner never validates the PostHog configuration.
 */
export const deploymentKeys = () => {
  const config = {
    NEXT_PHASE: Config.schema(optionalStringSchema, "NEXT_PHASE"),
    VERCEL_ENV: Config.schema(optionalStringSchema, "VERCEL_ENV"),
  };
  const values = {
    NEXT_PHASE: process.env.NEXT_PHASE,
    VERCEL_ENV: process.env.VERCEL_ENV,
  } satisfies Record<keyof typeof config, string | undefined>;
  return Effect.runSync(
    Config.all(config).parse(
      ConfigProvider.fromUnknown(values, { preserveEmptyStrings: true })
    )
  );
};
