import {
  appLocaleValidator,
  rendererDomainValidator,
} from "@repo/backend/confect/contentRelease/spec";
import { Schema, Struct } from "effect";

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
