import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export const publicResultValidator = Schema.Union([
  Schema.Null,
  Schema.Struct({
    activeManifestHash: Schema.String,
    activeReleaseId: Schema.String,
    artifactJson: Schema.String,
    delivery: Schema.Literal("public"),
    projectionHash: Schema.String,
    projectionJson: Schema.String,
    releaseJson: Schema.String,
    rendererJson: Schema.String,
    sourcePath: Schema.String,
  }),
]);
export const publicRequestValidator = Schema.Struct({
  appLocale: appLocaleValidator,
  publicPath: Schema.String,
});
export const publicBatchResultValidator = Schema.mutable(
  Schema.Array(publicResultValidator)
);
/** Stored active public row returned only to the authenticated HTTP adapter. */
export type PublicRuntimeRow = typeof publicResultValidator.Type;
/** Exact active signed publication identity exposed to server consumers. */
export const activeIdentityValidator = Schema.Union([
  Schema.Null,
  Schema.Struct({
    manifestHash: Schema.String,
    releaseId: Schema.String,
    sequence: Schema.Finite,
  }),
]);

/** Resolves whether one public path belongs to the active signed publication. */
export const routeResultValidator = Schema.Union([
  Schema.Struct({
    activeReleaseId: Schema.Union([Schema.String, Schema.Null]),
    kind: Schema.Literal("unmanaged"),
  }),
  Schema.Struct({
    activeReleaseId: Schema.String,
    kind: Schema.Literal("missing"),
  }),
  Schema.Struct({
    activeReleaseId: Schema.String,
    kind: Schema.Literal("found"),
    projectionJson: Schema.String,
  }),
]);
