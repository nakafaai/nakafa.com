import { InvalidEnvironmentError } from "@repo/utilities/env";
import { Config, ConfigProvider, Effect, Schema } from "effect";

const urlSchema = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter((value) => URL.canParse(value), {
      message: "Expected a valid URL.",
    })
  )
);
const optionalStringSchema = Schema.UndefinedOr(Schema.String);
/** Defines the Convex URL required by Next.js server adapters such as `convex/nextjs`. */
export const convexKeys = () => {
  const config = {
    NEXT_PUBLIC_CONVEX_URL: Config.schema(
      Schema.String,
      "NEXT_PUBLIC_CONVEX_URL"
    ),
  };
  const values = {
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
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
/** Defines the public Convex site URL used by auth and public HTTP adapters. */
export const convexSiteKeys = () => {
  const config = {
    NEXT_PUBLIC_CONVEX_SITE_URL: Config.schema(
      urlSchema,
      "NEXT_PUBLIC_CONVEX_SITE_URL"
    ),
  };
  const values = {
    NEXT_PUBLIC_CONVEX_SITE_URL: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
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
/** Reads the public Polar server selection. A missing or unknown value means sandbox. */
export const polarKeys = () => {
  const config = {
    NEXT_PUBLIC_POLAR_SERVER: Config.schema(
      optionalStringSchema,
      "NEXT_PUBLIC_POLAR_SERVER"
    ),
  };
  const values = {
    NEXT_PUBLIC_POLAR_SERVER: process.env.NEXT_PUBLIC_POLAR_SERVER,
  } satisfies Record<keyof typeof config, string | undefined>;
  return Effect.runSync(
    Config.all(config).parse(
      ConfigProvider.fromUnknown(values, { preserveEmptyStrings: true })
    )
  );
};
/**
 * Reads the Agent Mode trust values that Convex and Next validate at module
 * startup. An empty string stays set here. Effect Config treats it as missing on
 * Convex, which would silently drop the agent key or fall back to another URL,
 * so the literal record keeps empty strings as values.
 */
export const agentTrustKeys = () => {
  const config = {
    AKSARA_AGENT_SIGNING_KEY_ID: Config.schema(
      optionalStringSchema,
      "AKSARA_AGENT_SIGNING_KEY_ID"
    ),
    AKSARA_AGENT_SIGNING_PUBLIC_KEY: Config.schema(
      optionalStringSchema,
      "AKSARA_AGENT_SIGNING_PUBLIC_KEY"
    ),
    CONVEX_CLOUD_URL: Config.schema(optionalStringSchema, "CONVEX_CLOUD_URL"),
    NEXT_PUBLIC_CONVEX_URL: Config.schema(
      optionalStringSchema,
      "NEXT_PUBLIC_CONVEX_URL"
    ),
    VERCEL_ENV: Config.schema(optionalStringSchema, "VERCEL_ENV"),
  };
  const values = {
    AKSARA_AGENT_SIGNING_KEY_ID: process.env.AKSARA_AGENT_SIGNING_KEY_ID,
    AKSARA_AGENT_SIGNING_PUBLIC_KEY:
      process.env.AKSARA_AGENT_SIGNING_PUBLIC_KEY,
    CONVEX_CLOUD_URL: process.env.CONVEX_CLOUD_URL,
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  } satisfies Record<keyof typeof config, string | undefined>;
  return Effect.runSync(
    Config.all(config).parse(
      ConfigProvider.fromUnknown(values, { preserveEmptyStrings: true })
    )
  );
};
