import { createEnv } from "@t3-oss/env-nextjs";
import { Config, ConfigProvider, Effect, Schema } from "effect";

const requiredStringSchema = Schema.toStandardSchemaV1(Schema.NonEmptyString);
const requiredUrlSchema = Schema.toStandardSchemaV1(
  Schema.String.pipe(
    Schema.check(
      Schema.makeFilter((value) => URL.canParse(value), {
        message: "Expected a valid URL.",
      })
    )
  )
);
/** Defines the Aksara token accepted by publication-owned WWW routes. */
export const publicationKeys = () =>
  createEnv({
    server: {
      AKSARA_PUBLICATION_TOKEN: requiredStringSchema,
    },
    runtimeEnv: {
      AKSARA_PUBLICATION_TOKEN: process.env.AKSARA_PUBLICATION_TOKEN,
    },
  });
/** Defines the private token used only by executable-content runtime reads. */
export const contentRuntimeKeys = () => {
  const config = {
    CONTENT_RUNTIME_TOKEN: Config.schema(
      Schema.NonEmptyString,
      "CONTENT_RUNTIME_TOKEN"
    ),
  };
  const values = {
    CONTENT_RUNTIME_TOKEN: process.env.CONTENT_RUNTIME_TOKEN,
  } satisfies Record<keyof typeof config, string | undefined>;
  return Effect.runSync(
    Config.all(config).parse(
      ConfigProvider.fromUnknown(values, { preserveEmptyStrings: true })
    )
  );
};
/** Reads the private target required by signed public content consumers. */
export function readContentRuntimeTarget(siteUrl: string) {
  const keys = contentRuntimeKeys();
  return {
    siteUrl,
    token: keys.CONTENT_RUNTIME_TOKEN,
  };
}
/** Defines the canonical site URL used by server-side absolute URL builders. */
export const siteUrlKeys = () =>
  createEnv({
    server: {
      SITE_URL: requiredUrlSchema,
    },
    runtimeEnv: {
      SITE_URL: process.env.SITE_URL,
    },
  });
/** Defines the public app origin that client and server absolute URL builders share. */
export const appUrlKeys = () =>
  createEnv({
    client: {
      NEXT_PUBLIC_APP_URL: requiredStringSchema,
    },
    runtimeEnv: {
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    },
  });
/** Reads the Aksara preview fields, each absent unless the development child sets it. */
export const previewKeys = () => {
  const optional = Schema.UndefinedOr(Schema.String);
  const config = {
    AKSARA_PREVIEW_EVENTS_PATH: Config.schema(
      optional,
      "AKSARA_PREVIEW_EVENTS_PATH"
    ),
    AKSARA_PREVIEW_KEY_ID: Config.schema(optional, "AKSARA_PREVIEW_KEY_ID"),
    AKSARA_PREVIEW_MANIFEST_PATH: Config.schema(
      optional,
      "AKSARA_PREVIEW_MANIFEST_PATH"
    ),
    AKSARA_PREVIEW_ORIGIN: Config.schema(optional, "AKSARA_PREVIEW_ORIGIN"),
    AKSARA_PREVIEW_PUBLIC_KEY: Config.schema(
      optional,
      "AKSARA_PREVIEW_PUBLIC_KEY"
    ),
    AKSARA_PREVIEW_PROVIDER_TOKEN: Config.schema(
      optional,
      "AKSARA_PREVIEW_PROVIDER_TOKEN"
    ),
    AKSARA_PREVIEW_RENDERER_SECRET: Config.schema(
      optional,
      "AKSARA_PREVIEW_RENDERER_SECRET"
    ),
    AKSARA_PREVIEW_RENDERER_TOKEN: Config.schema(
      optional,
      "AKSARA_PREVIEW_RENDERER_TOKEN"
    ),
  };
  const values = {
    AKSARA_PREVIEW_EVENTS_PATH: process.env.AKSARA_PREVIEW_EVENTS_PATH,
    AKSARA_PREVIEW_KEY_ID: process.env.AKSARA_PREVIEW_KEY_ID,
    AKSARA_PREVIEW_MANIFEST_PATH: process.env.AKSARA_PREVIEW_MANIFEST_PATH,
    AKSARA_PREVIEW_ORIGIN: process.env.AKSARA_PREVIEW_ORIGIN,
    AKSARA_PREVIEW_PUBLIC_KEY: process.env.AKSARA_PREVIEW_PUBLIC_KEY,
    AKSARA_PREVIEW_PROVIDER_TOKEN: process.env.AKSARA_PREVIEW_PROVIDER_TOKEN,
    AKSARA_PREVIEW_RENDERER_SECRET: process.env.AKSARA_PREVIEW_RENDERER_SECRET,
    AKSARA_PREVIEW_RENDERER_TOKEN: process.env.AKSARA_PREVIEW_RENDERER_TOKEN,
  } satisfies Record<keyof typeof config, string | undefined>;
  return Effect.runSync(
    Config.all(config).parse(
      ConfigProvider.fromUnknown(values, { preserveEmptyStrings: true })
    )
  );
};
