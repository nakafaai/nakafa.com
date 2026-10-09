import { Config, ConfigProvider, Effect, Result, Schema } from "effect";

/** One environment value failed its schema. The message keeps the variable name. */
class InvalidEnvironmentError extends Schema.TaggedError<InvalidEnvironmentError>()(
  "InvalidEnvironmentError",
  { details: Schema.String }
) {
  get message() {
    return `Invalid environment variables: ${this.details}`;
  }
}

const requiredUrlSchema = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter((value) => URL.canParse(value), {
      message: "Expected a valid URL.",
    })
  )
);
const appUrlSchema = Schema.Struct({
  NEXT_PUBLIC_APP_URL: Schema.NonEmptyString,
});
/** Defines the Aksara token accepted by publication-owned WWW routes. */
export const publicationKeys = () => {
  const config = {
    AKSARA_PUBLICATION_TOKEN: Config.schema(
      Schema.NonEmptyString,
      "AKSARA_PUBLICATION_TOKEN"
    ),
  };
  const values = {
    AKSARA_PUBLICATION_TOKEN: process.env.AKSARA_PUBLICATION_TOKEN,
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
    Config.all(config)
      .parse(ConfigProvider.fromUnknown(values, { preserveEmptyStrings: true }))
      .pipe(
        Effect.mapError(
          (error) => new InvalidEnvironmentError({ details: error.message })
        )
      )
  );
};
/** Defines the canonical site URL used by server-side absolute URL builders. */
export const siteUrlKeys = () => {
  const config = {
    SITE_URL: Config.schema(requiredUrlSchema, "SITE_URL"),
  };
  const values = {
    SITE_URL: process.env.SITE_URL,
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
 * Defines the public app origin that client and server absolute URL builders
 * share. It decodes synchronously, because it runs on every render of a client
 * component and must not start an Effect runtime.
 */
export const appUrlKeys = () => {
  const values = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  } satisfies Record<keyof typeof appUrlSchema.Type, string | undefined>;
  return Result.getOrThrowWith(
    Schema.decodeUnknownResult(appUrlSchema)(values),
    (error) => new InvalidEnvironmentError({ details: error.message })
  );
};
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
