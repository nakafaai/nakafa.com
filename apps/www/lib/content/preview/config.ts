import "server-only";

import {
  type SigningKeyId,
  SigningKeyIdSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  type PreviewRendererSecret,
  PreviewRendererSecretSchema,
} from "@nakafa/aksara-contracts/preview/auth";
import { Effect, Option, Redacted, Schema } from "effect";

const PreviewTokenSchema = Schema.NonEmptyTrimmedString.pipe(
  Schema.maxLength(4096)
);
const PreviewArtifactPathSchema = Schema.String.pipe(
  Schema.pattern(/^\/v1\/artifacts\/sha256%3A[0-9a-f]{64}$/u)
);
const PreviewEventsPathSchema = Schema.Literal("/v1/events");
const PreviewManifestPathSchema = Schema.Literal("/v1/manifest");
const PreviewPathSchema = Schema.Union(
  PreviewEventsPathSchema,
  PreviewManifestPathSchema,
  PreviewArtifactPathSchema
);
const PreviewOriginSchema = Schema.String.pipe(
  Schema.pattern(/^http:\/\/127\.0\.0\.1:\d+\/$/u)
);
const PreviewPublicKeySchema = Schema.String.pipe(
  Schema.startsWith("-----BEGIN PUBLIC KEY-----\n"),
  Schema.endsWith("-----END PUBLIC KEY-----\n"),
  Schema.maxLength(4096)
);
const PreviewEnvironmentSchema = Schema.Struct({
  eventsPath: PreviewEventsPathSchema,
  keyId: SigningKeyIdSchema,
  manifestPath: PreviewManifestPathSchema,
  origin: PreviewOriginSchema,
  publicKey: PreviewPublicKeySchema,
  token: PreviewTokenSchema,
});
const PreviewRendererEnvironmentSchema = Schema.Struct({
  secret: PreviewRendererSecretSchema,
  token: PreviewTokenSchema,
});

/** Reads the one dedicated process-environment boundary without exposing it. */
function readEnvironment() {
  return {
    eventsPath: process.env.AKSARA_PREVIEW_EVENTS_PATH,
    keyId: process.env.AKSARA_PREVIEW_KEY_ID,
    manifestPath: process.env.AKSARA_PREVIEW_MANIFEST_PATH,
    origin: process.env.AKSARA_PREVIEW_ORIGIN,
    publicKey: process.env.AKSARA_PREVIEW_PUBLIC_KEY,
    token: process.env.AKSARA_PREVIEW_PROVIDER_TOKEN,
  };
}

/** Reads only the ephemeral renderer authentication fields. */
function readRendererEnvironment() {
  return {
    secret: process.env.AKSARA_PREVIEW_RENDERER_SECRET,
    token: process.env.AKSARA_PREVIEW_RENDERER_TOKEN,
  };
}

/** Complete ephemeral connection passed by the Aksara CLI child process. */
export interface PreviewConfig {
  readonly eventsPath: "/v1/events";
  readonly keyId: SigningKeyId;
  readonly manifestPath: "/v1/manifest";
  readonly origin: URL;
  readonly publicKey: string;
  readonly token: Redacted.Redacted<string>;
}

/** Ephemeral credentials accepted only by the local renderer endpoint. */
export interface PreviewRendererConfig {
  readonly secret: PreviewRendererSecret;
  readonly token: Redacted.Redacted<string>;
}

/** Local preview configuration exists but does not satisfy its strict shape. */
export class PreviewConfigError extends Schema.TaggedError<PreviewConfigError>()(
  "PreviewConfigError",
  { name: Schema.Literal("AKSARA_PREVIEW") }
) {}

/** Local renderer credentials exist but do not satisfy their strict shape. */
export class PreviewRendererConfigError extends Schema.TaggedError<PreviewRendererConfigError>()(
  "PreviewRendererConfigError",
  { name: Schema.Literal("AKSARA_PREVIEW_RENDERER") }
) {}

/** Builds one validated preview URL without allowing its origin to change. */
export const previewUrl = Effect.fn("NakafaContent.previewUrl")(function* (
  config: PreviewConfig,
  path: string
) {
  const decodedPath = yield* Schema.decodeUnknown(PreviewPathSchema)(path).pipe(
    Effect.mapError(() => new PreviewConfigError({ name: "AKSARA_PREVIEW" }))
  );
  const target = new URL(decodedPath, config.origin);

  if (target.origin !== config.origin.origin) {
    return yield* new PreviewConfigError({ name: "AKSARA_PREVIEW" });
  }

  return target;
});

/**
 * Reports whether a development child supplied any preview connection field.
 *
 * Next route boundaries use this pure check to avoid starting Effect's runtime
 * during production static prerender. Partial configuration deliberately
 * returns true so strict decoding exposes the error instead of falling back.
 */
export function hasPreviewConfig() {
  return (
    process.env.NODE_ENV === "development" &&
    Object.values(readEnvironment()).some((value) => value !== undefined)
  );
}

/** Reads the complete ephemeral connection only in the development child. */
export const readPreviewConfig = Effect.fn("NakafaContent.readPreviewConfig")(
  () => {
    if (process.env.NODE_ENV !== "development") {
      return Effect.succeed(Option.none<PreviewConfig>());
    }

    const environment = readEnvironment();
    if (Object.values(environment).every((value) => value === undefined)) {
      return Effect.succeed(Option.none<PreviewConfig>());
    }

    return Schema.decodeUnknown(PreviewEnvironmentSchema)(environment, {
      onExcessProperty: "error",
    }).pipe(
      Effect.flatMap((value) =>
        Effect.try({
          catch: () => new PreviewConfigError({ name: "AKSARA_PREVIEW" }),
          try: () =>
            Option.some<PreviewConfig>({
              eventsPath: value.eventsPath,
              keyId: value.keyId,
              manifestPath: value.manifestPath,
              origin: new URL(value.origin),
              publicKey: value.publicKey,
              token: Redacted.make(value.token),
            }),
        })
      ),
      Effect.mapError(() => new PreviewConfigError({ name: "AKSARA_PREVIEW" }))
    );
  }
);

/** Reads independent local renderer credentials only in the development child. */
export const readPreviewRendererConfig = Effect.fn(
  "NakafaContent.readPreviewRendererConfig"
)(() => {
  if (process.env.NODE_ENV !== "development") {
    return Effect.succeed(Option.none<PreviewRendererConfig>());
  }

  const environment = readRendererEnvironment();
  if (Object.values(environment).every((value) => value === undefined)) {
    return Effect.succeed(Option.none<PreviewRendererConfig>());
  }

  return Schema.decodeUnknown(PreviewRendererEnvironmentSchema)(environment, {
    onExcessProperty: "error",
  }).pipe(
    Effect.map((value) =>
      Option.some<PreviewRendererConfig>({
        secret: value.secret,
        token: Redacted.make(value.token),
      })
    ),
    Effect.mapError(
      () => new PreviewRendererConfigError({ name: "AKSARA_PREVIEW_RENDERER" })
    )
  );
});
