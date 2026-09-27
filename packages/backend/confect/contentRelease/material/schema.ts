import { modelSlotValidator } from "@repo/backend/confect/contentRelease/models/slot";
import {
  appLocaleValidator,
  rendererDomainValidator,
} from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export const materialFields = {
  appLocale: appLocaleValidator,
  assetId: Schema.String,
  bucket: Schema.String,
  contentKey: Schema.String,
  materialKey: Schema.String,
  order: Schema.Finite,
  parentPath: Schema.String,
  projectionHash: Schema.String,
  projectionJson: Schema.String,
  publicPath: Schema.String,
  releaseId: Schema.String,
  rendererDomain: rendererDomainValidator,
  sequence: Schema.Finite,
  sourcePath: Schema.String,
  topicAssetId: Schema.String,
  slot: modelSlotValidator,
};
