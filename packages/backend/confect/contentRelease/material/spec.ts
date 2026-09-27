import {
  appLocaleValidator,
  rendererDomainValidator,
} from "@repo/backend/confect/contentRelease/spec";
import { Schema, Struct } from "effect";
/** One signed-publication row selected for the partner API. */
export const materialApiEntryValidator = Schema.Struct({
  appLocale: appLocaleValidator,
  publicPath: Schema.String,
});

/** Bounded material partner page selected in one Convex transaction. */
export const materialApiPageValidator = Schema.Struct({
  activeReleaseId: Schema.String,
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  page: Schema.mutable(Schema.Array(materialApiEntryValidator)),
});

/** Complete material route model retained by existing public consumers. */
export const materialModelValidator = Schema.Struct({
  activeManifestHash: Schema.Union([Schema.String, Schema.Null]),
  activeAppLocales: Schema.mutable(Schema.Array(appLocaleValidator)),
  activeReleaseId: Schema.Union([Schema.String, Schema.Null]),
  alternateJson: Schema.mutable(Schema.Array(Schema.String)),
  projectionJson: Schema.Union([Schema.String, Schema.Null]),
  rendererDomain: Schema.Union([rendererDomainValidator, Schema.Null]),
  siblingJson: Schema.mutable(Schema.Array(Schema.String)),
  sourcePath: Schema.Union([Schema.String, Schema.Null]),
  sourceRevision: Schema.Union([Schema.String, Schema.Null]),
});

/** Navigation authenticated against one active material publication. */
export const materialNavigationValidator = materialModelValidator.mapFields(
  Struct.pick(["activeManifestHash", "activeReleaseId", "siblingJson"])
);
