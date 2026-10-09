import "server-only";
import { SigningKeyIdSchema } from "@nakafa/aksara-contracts/ids";
import { PreviewRendererSecretSchema } from "@nakafa/aksara-contracts/preview/auth";
import {
  hasPreviewProvider,
  hasPreviewRenderer,
} from "@repo/next-config/preview";
import { Effect, Option, Redacted, Result, Schema } from "effect";
import {
  readPreviewEnvironment,
  readPreviewRendererEnvironment,
} from "@/lib/content/preview/environment";

const PreviewTokenSchema = Schema.Trimmed.check(Schema.isNonEmpty()).pipe(
  Schema.check(Schema.isMaxLength(4096))
);
const PreviewArtifactPathSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^\/artifacts\/sha256%3A[0-9a-f]{64}$/u))
);
const PreviewEventsPathSchema = Schema.Literal("/events");
const PreviewManifestPathSchema = Schema.Literal("/manifest");
const PreviewPathSchema = Schema.Union([
  PreviewEventsPathSchema,
  PreviewManifestPathSchema,
  PreviewArtifactPathSchema,
]);
const PreviewOriginSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^http:\/\/127\.0\.0\.1:\d+\/$/u))
);
const PreviewPublicKeySchema = Schema.String.check(
  Schema.isStartingWith("-----BEGIN PUBLIC KEY-----\n"),
  Schema.isEndingWith("-----END PUBLIC KEY-----\n"),
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
export const PreviewConfigSchema = Schema.Struct({
  eventsPath: PreviewEventsPathSchema,
  keyId: SigningKeyIdSchema,
  manifestPath: PreviewManifestPathSchema,
  origin: Schema.URL,
  publicKey: PreviewPublicKeySchema,
  token: Schema.Redacted(Schema.String),
});
/** Complete ephemeral connection passed by the Aksara CLI child process. */
export type PreviewConfig = typeof PreviewConfigSchema.Type;
const PreviewRendererConfigSchema = Schema.Struct({
  secret: PreviewRendererSecretSchema,
  token: Schema.Redacted(Schema.String),
});
/** Ephemeral credentials accepted only by the local renderer endpoint. */
export type PreviewRendererConfig = typeof PreviewRendererConfigSchema.Type;
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
  return hasPreviewProvider();
}
/**
 * Reads the complete ephemeral connection only when the development child set
 * a provider field. `hasPreviewProvider` owns that check for every caller.
 */
export const readPreviewConfig = Effect.fn("NakafaContent.readPreviewConfig")(
  function* () {
    if (!hasPreviewProvider()) {
      return Option.none<PreviewConfig>();
    }
    const decoded = decodePreviewEnvironment(readPreviewEnvironment());
    if (Result.isFailure(decoded)) {
      return yield* decoded.failure;
    }
    return Option.some<PreviewConfig>(decoded.success);
  }
);
/**
 * Reads independent local renderer credentials only when the development child
 * set a renderer field. `hasPreviewRenderer` owns that check.
 */
export const readPreviewRendererConfig = Effect.fn(
  "NakafaContent.readPreviewRendererConfig"
)(() => {
  if (!hasPreviewRenderer()) {
    return Effect.succeed(Option.none<PreviewRendererConfig>());
  }
  return Schema.decodeUnknownEffect(PreviewRendererEnvironmentSchema)(
    readPreviewRendererEnvironment(),
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
