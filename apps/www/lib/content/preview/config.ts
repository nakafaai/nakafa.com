import "server-only";
import {
  type SigningKeyId,
  SigningKeyIdSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  type PreviewRendererSecret,
  PreviewRendererSecretSchema,
} from "@nakafa/aksara-contracts/preview/auth";
import { hasCandidateLocalePreview } from "@repo/internationalization/src/environment";
import { Effect, Option, Redacted, Result, Schema } from "effect";
import {
  readPreviewEnvironment,
  readPreviewRendererEnvironment,
} from "@/lib/content/preview/environment";

const PreviewTokenSchema = Schema.Trimmed.check(Schema.isNonEmpty()).pipe(
  Schema.check(Schema.isMaxLength(4096))
);
const PreviewArtifactPathSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^\/v1\/artifacts\/sha256%3A[0-9a-f]{64}$/u))
);
const PreviewEventsPathSchema = Schema.Literal("/v1/events");
const PreviewManifestPathSchema = Schema.Literal("/v1/manifest");
const PreviewPathSchema = Schema.Union([
  PreviewEventsPathSchema,
  PreviewManifestPathSchema,
  PreviewArtifactPathSchema,
]);
const PreviewOriginSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^http:\/\/127\.0\.0\.1:\d+\/$/u))
);
const PreviewPublicKeySchema = Schema.String.check(
  Schema.isStartsWith("-----BEGIN PUBLIC KEY-----\n"),
  Schema.isEndsWith("-----END PUBLIC KEY-----\n"),
  Schema.isMaxLength(4096)
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
/** Decodes one complete child-process environment without starting a runtime. */
export function decodePreviewEnvironment(
  environment: ReturnType<typeof readPreviewEnvironment>
) {
  const decoded = Schema.decodeUnknownResult(PreviewEnvironmentSchema)(
    environment,
    { onExcessProperty: "error" }
  );
  if (Result.isFailure(decoded)) {
    return Result.fail(new PreviewConfigError({ name: "AKSARA_PREVIEW" }));
  }
  return Result.try({
    catch: () => new PreviewConfigError({ name: "AKSARA_PREVIEW" }),
    try: () => ({
      eventsPath: decoded.success.eventsPath,
      keyId: decoded.success.keyId,
      manifestPath: decoded.success.manifestPath,
      origin: new URL(decoded.success.origin),
      publicKey: decoded.success.publicKey,
      token: Redacted.make(decoded.success.token),
    }),
  });
}
/** Validates one provider path and preserves the configured loopback origin. */
export function decodePreviewUrl(config: PreviewConfig, path: string) {
  const decodedPath = Schema.decodeResult(PreviewPathSchema)(path);
  if (Result.isFailure(decodedPath)) {
    return Result.fail(new PreviewConfigError({ name: "AKSARA_PREVIEW" }));
  }
  const target = new URL(decodedPath.success, config.origin);
  if (target.origin !== config.origin.origin) {
    return Result.fail(new PreviewConfigError({ name: "AKSARA_PREVIEW" }));
  }
  return Result.succeed(target);
}
/** Builds one validated preview URL without allowing its origin to change. */
export const previewUrl = Effect.fn("NakafaContent.previewUrl")(function* (
  config: PreviewConfig,
  path: string
) {
  const target = decodePreviewUrl(config, path);
  if (Result.isFailure(target)) {
    return yield* target.failure;
  }
  return target.success;
});
/**
 * Reports whether a development child supplied any preview connection field.
 *
 * Next route boundaries use this pure check to avoid starting Effect's runtime
 * during production static prerender. Partial configuration deliberately
 * returns true so strict decoding exposes the error instead of falling back.
 */
export function hasPreviewConfig() {
  return hasCandidateLocalePreview();
}
/** Reads the complete ephemeral connection only in the development child. */
export const readPreviewConfig = Effect.fn("NakafaContent.readPreviewConfig")(
  function* () {
    if (process.env.NODE_ENV !== "development") {
      return Option.none<PreviewConfig>();
    }
    const environment = readPreviewEnvironment();
    if (Object.values(environment).every((value) => value === undefined)) {
      return Option.none<PreviewConfig>();
    }
    const decoded = decodePreviewEnvironment(environment);
    if (Result.isFailure(decoded)) {
      return yield* decoded.failure;
    }
    return Option.some<PreviewConfig>(decoded.success);
  }
);
/** Reads independent local renderer credentials only in the development child. */
export const readPreviewRendererConfig = Effect.fn(
  "NakafaContent.readPreviewRendererConfig"
)(() => {
  if (process.env.NODE_ENV !== "development") {
    return Effect.succeed(Option.none<PreviewRendererConfig>());
  }
  const environment = readPreviewRendererEnvironment();
  if (Object.values(environment).every((value) => value === undefined)) {
    return Effect.succeed(Option.none<PreviewRendererConfig>());
  }
  return Schema.decodeUnknownEffect(PreviewRendererEnvironmentSchema)(
    environment,
    {
      onExcessProperty: "error",
    }
  ).pipe(
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
